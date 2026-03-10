-- View: current_rounds (v2)
-- Omskrevet til at basere sig på rounds + matches i stedet for league_matches.
-- Bruges i: games/[id]/page.tsx, dashboard/page.tsx, api/games/create/route.ts,
--           api/admin/leagues/overview/route.ts, api/admin/games/search/route.ts
--
-- Logik:
--   1. Prioritér runder med status = 'open' (aktiv betting)
--   2. Dernæst 'upcoming' med first_kickoff <= NOW() + 7 dage
--   3. Én runde per league_id (den mest relevante)

DROP VIEW IF EXISTS current_rounds;

CREATE OR REPLACE VIEW current_rounds AS
WITH round_stats AS (
  SELECT
    r.id                       AS round_id,
    r.league_id,
    r.name                     AS round_name,
    r.status,
    r.betting_closes_at,
    min(m.kickoff_at)          AS first_kickoff,
    max(m.kickoff_at)          AS last_kickoff,
    min(m.kickoff_at) FILTER (WHERE m.kickoff_at >= now()) AS next_kickoff,
    count(m.id)                AS match_count,
    count(m.id) FILTER (WHERE m.status = 'finished') AS finished_count
  FROM rounds r
  LEFT JOIN matches m ON m.round_id = r.id
  WHERE r.league_id IS NOT NULL
    AND r.status IN ('open', 'upcoming')
  GROUP BY r.id, r.league_id, r.name, r.status, r.betting_closes_at
),
ranked AS (
  SELECT
    rs.*,
    row_number() OVER (
      PARTITION BY rs.league_id
      ORDER BY
        -- 1) open først, 2) upcoming med kickoff inden 7 dage, 3) resten
        CASE
          WHEN rs.status = 'open' THEN 1
          WHEN rs.status = 'upcoming'
               AND rs.first_kickoff <= (now() + interval '7 days') THEN 2
          ELSE 3
        END,
        -- Inden for samme prioritet: tidligste kickoff først
        rs.first_kickoff
    ) AS rn
  FROM round_stats rs
)
SELECT
  r.league_id,
  l.name                                       AS league_name,
  r.round_id,
  r.round_name,
  r.first_kickoff,
  r.last_kickoff,
  COALESCE(r.next_kickoff, r.last_kickoff)     AS next_kickoff,
  r.betting_closes_at,
  r.match_count,
  r.finished_count,
  -- Map til round_status som consumers forventer
  CASE
    WHEN r.status = 'open' THEN 'active'
    ELSE 'upcoming'
  END                                          AS round_status
FROM ranked r
JOIN leagues l ON l.id = r.league_id
WHERE r.rn = 1
ORDER BY l.name;
