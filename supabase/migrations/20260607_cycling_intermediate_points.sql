-- ============================================================================
-- Sprint- og bjerg-konkurrence-points pr. etape
--
-- PCS publicerer separate "points classification" og "KOM classification"
-- tabeller pr. etape (fx /race/dauphine/2026/stage-1-points). Hver rytter
-- der scorer i en mellem-sprint eller på et bjerg-top får et point-tal
-- tildelt der løber ind i den samlede sæson-konkurrence.
--
-- Brugerne får nu disse points DIREKTE oveni deres lineup-score (1:1):
-- hvis Baudin scorer 15 sprint-points på etapen, får alle spillere der
-- har valgt Baudin (uanset rolle) +15 til deres total.
-- ============================================================================

-- 1) Per-rytter, per-etape points
ALTER TABLE cycling_results
  ADD COLUMN IF NOT EXISTS sprint_points int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mountain_points int NOT NULL DEFAULT 0;

COMMENT ON COLUMN cycling_results.sprint_points IS
  'Points scoret i points-konkurrencen (sprint) på denne etape — fra PCS /stage-N-points';
COMMENT ON COLUMN cycling_results.mountain_points IS
  'Points scoret i bjerg-konkurrencen (KOM) på denne etape — fra PCS /stage-N-kom';

-- 2) Tilføj intermediate_points-bidrag til scoring og genskab total_points-formelen
ALTER TABLE cycling_scores DROP COLUMN IF EXISTS total_points;

ALTER TABLE cycling_scores
  ADD COLUMN IF NOT EXISTS intermediate_points numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN cycling_scores.intermediate_points IS
  'Sprint + KOM points scoret af rytteren på etapen, 1:1 fra PCS. Lægges oveni base-scoring uden multiplier.';

ALTER TABLE cycling_scores
  ADD COLUMN total_points numeric GENERATED ALWAYS AS (
    (base_points * role_multiplier * gc_multiplier)
    + role_bonus
    + jersey_points
    + team_bonus
    + intermediate_points
  ) STORED;

COMMENT ON COLUMN cycling_scores.total_points IS
  'Beregnet automatisk: base × role_mul × gc_mul + role_bonus + jersey_points + team_bonus + intermediate_points. Ingen straffe.';
