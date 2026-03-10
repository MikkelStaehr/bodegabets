-- ============================================================================
-- Migration: Dedupliker rounds/matches og fjern game_id fra rounds
-- ============================================================================
-- BAGGRUND: rounds har i dag både game_id og league_id. Når 3 spilrum bruger
-- Premier League oprettes 3 × 38 = 114 runder og 3 × 380 = 1140 kampe.
-- MÅL: rounds og matches tilhører en liga, ikke et spilrum.
--
-- VIGTIGT: Kør denne migration i én transaktion i Supabase SQL Editor.
--          Tag backup først!
-- ============================================================================

BEGIN;

-- ─── Trin 0: Opret temp-tabel med mapping fra alle round_ids → beholdt round_id ──
-- For hvert (league_id, name) par beholder vi runden med laveste id.

CREATE TEMP TABLE round_mapping AS
WITH keeper AS (
  SELECT DISTINCT ON (league_id, name)
    id AS keep_id,
    league_id,
    name
  FROM rounds
  WHERE league_id IS NOT NULL
  ORDER BY league_id, name, id ASC  -- laveste id vinder
)
SELECT
  r.id   AS old_id,
  k.keep_id
FROM rounds r
JOIN keeper k ON k.league_id = r.league_id AND k.name = r.name
WHERE r.league_id IS NOT NULL;

-- Indeks for hurtigere lookups
CREATE INDEX ON round_mapping (old_id);
CREATE INDEX ON round_mapping (keep_id);

-- Bekræft mapping ser fornuftig ud (kan inspiceres i output)
DO $$
DECLARE
  total_rounds   INT;
  kept_rounds    INT;
  duplicate_rounds INT;
BEGIN
  SELECT count(*) INTO total_rounds FROM round_mapping;
  SELECT count(DISTINCT keep_id) INTO kept_rounds FROM round_mapping;
  duplicate_rounds := total_rounds - kept_rounds;
  RAISE NOTICE '=== Round dedup: % total → % beholdes, % duplikater fjernes ===',
    total_rounds, kept_rounds, duplicate_rounds;
END $$;


-- ─── Trin 1: Opret temp-tabel med match-mapping ────────────────────────────
-- Matches der tilhører duplikerede runder skal slettes, men først skal vi
-- mappe eventuelle bets der peger på matches i de slettede runder.
-- Matches mappes via (round → kept_round) + (home_team, away_team, kickoff_at).

CREATE TEMP TABLE match_mapping AS
SELECT
  m_old.id   AS old_match_id,
  m_keep.id  AS keep_match_id
FROM matches m_old
JOIN round_mapping rm ON rm.old_id = m_old.round_id
  AND rm.old_id != rm.keep_id
JOIN matches m_keep ON m_keep.round_id  = rm.keep_id
  AND m_keep.home_team  = m_old.home_team
  AND m_keep.away_team  = m_old.away_team
  AND m_keep.kickoff_at = m_old.kickoff_at;

CREATE INDEX ON match_mapping (old_match_id);


-- ─── Trin 2: Opdater bets.round_id til beholdte runder ─────────────────────

UPDATE bets b
SET round_id = rm.keep_id
FROM round_mapping rm
WHERE b.round_id = rm.old_id
  AND rm.old_id != rm.keep_id;

-- Opdater også bets.match_id til beholdte matches
UPDATE bets b
SET match_id = mm.keep_match_id
FROM match_mapping mm
WHERE b.match_id = mm.old_match_id;

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM bets WHERE round_id IN (SELECT keep_id FROM round_mapping);
  RAISE NOTICE '=== Bets efter remap: % rækker har opdateret round_id ===', cnt;
END $$;


-- ─── Trin 3: Opdater round_scores.round_id til beholdte runder ─────────────

-- Slet round_scores der vil konflikte ved remap (samme user + kept round findes allerede)
DELETE FROM round_scores rs
WHERE rs.round_id IN (SELECT old_id FROM round_mapping WHERE old_id != keep_id)
  AND EXISTS (
    SELECT 1 FROM round_scores rs2
    JOIN round_mapping rm ON rm.old_id = rs.round_id
    WHERE rs2.user_id = rs.user_id AND rs2.round_id = rm.keep_id
  );

UPDATE round_scores rs
SET round_id = rm.keep_id
FROM round_mapping rm
WHERE rs.round_id = rm.old_id
  AND rm.old_id != rm.keep_id;


-- ─── Trin 4: Slet duplikerede matches ──────────────────────────────────────
-- Slet matches der tilhører runder vi fjerner.

DELETE FROM matches m
USING round_mapping rm
WHERE m.round_id = rm.old_id
  AND rm.old_id != rm.keep_id;


-- ─── Trin 5: Slet duplikerede runder ───────────────────────────────────────

DELETE FROM rounds r
USING round_mapping rm
WHERE r.id = rm.old_id
  AND rm.old_id != rm.keep_id;

DO $$
DECLARE
  remaining_rounds INT;
  remaining_matches INT;
BEGIN
  SELECT count(*) INTO remaining_rounds FROM rounds;
  SELECT count(*) INTO remaining_matches FROM matches;
  RAISE NOTICE '=== Efter dedup: % runder, % kampe tilbage ===',
    remaining_rounds, remaining_matches;
END $$;


-- ─── Trin 6: Fjern game_id kolonnen fra rounds ────────────────────────────
-- Først drop eventuelle constraints/indexes der bruger game_id

-- Drop RLS policy der refererer rounds.game_id
DROP POLICY IF EXISTS "Members can read rounds" ON public.rounds;

-- Drop RLS policy på matches der joiner via rounds.game_id
DROP POLICY IF EXISTS "Members can read matches" ON public.matches;

-- Drop den faktiske kolonne
ALTER TABLE rounds DROP COLUMN IF EXISTS game_id;


-- ─── Trin 7: Gør league_id NOT NULL ───────────────────────────────────────

-- Slet eventuelle runder uden league_id (orphans)
DELETE FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE league_id IS NULL);
DELETE FROM rounds WHERE league_id IS NULL;

ALTER TABLE rounds ALTER COLUMN league_id SET NOT NULL;


-- ─── Trin 8: Genopret RLS policies uden game_id ───────────────────────────
-- Rounds er nu liga-ejede, så alle autentificerede brugere kan læse dem.

CREATE POLICY "Authenticated users can read rounds" ON public.rounds
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read matches" ON public.matches
  FOR SELECT
  USING (auth.role() = 'authenticated');


-- ─── Oprydning ─────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS match_mapping;
DROP TABLE IF EXISTS round_mapping;

COMMIT;
