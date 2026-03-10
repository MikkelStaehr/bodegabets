-- View: current_rounds
-- Bruges i: games/[id]/page.tsx, dashboard/page.tsx, api/games/create/route.ts
-- Beskrivelse: Returnerer én række per liga med aktuel runde, status,
--              first/last/next kickoff og antal kampe.

CREATE OR REPLACE VIEW current_rounds AS
WITH round_stats AS (
  SELECT
    lm.league_id,
    lm.round_name,
    min(lm.kickoff_at) AS first_kickoff,
    max(lm.kickoff_at) AS last_kickoff,
    min(lm.kickoff_at) FILTER (WHERE (lm.kickoff_at >= now())) AS next_kickoff,
    count(*) AS match_count,
    sum(CASE WHEN (lm.status = 'finished'::text) THEN 1 ELSE 0 END) AS finished_count
  FROM league_matches lm
  GROUP BY lm.league_id, lm.round_name
),
ranked AS (
  SELECT
    rs.league_id,
    rs.round_name,
    rs.first_kickoff,
    rs.last_kickoff,
    rs.next_kickoff,
    rs.match_count,
    rs.finished_count,
    CASE
      WHEN ((rs.first_kickoff <= now()) AND (rs.last_kickoff >= now())) THEN 'active'::text
      WHEN (rs.first_kickoff > now()) THEN 'upcoming'::text
      ELSE 'finished'::text
    END AS round_status,
    row_number() OVER (
      PARTITION BY rs.league_id
      ORDER BY
        CASE
          WHEN ((rs.first_kickoff <= now()) AND (rs.last_kickoff >= now())) THEN 1
          WHEN (rs.first_kickoff > now()) THEN 2
          ELSE 3
        END,
        rs.first_kickoff
    ) AS rn
  FROM round_stats rs
  WHERE (rs.last_kickoff >= (now() - '1 day'::interval))
)
SELECT
  r.league_id,
  l.name AS league_name,
  r.round_name,
  r.first_kickoff,
  r.last_kickoff,
  COALESCE(r.next_kickoff, r.last_kickoff) AS next_kickoff,
  r.match_count,
  r.finished_count,
  r.round_status
FROM (ranked r JOIN leagues l ON ((l.id = r.league_id)))
WHERE (r.rn = 1)
ORDER BY l.name;
