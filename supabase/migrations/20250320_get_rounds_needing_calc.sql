-- Runder hvor alle kampe allerede er finished, men round.status endnu ikke er 'finished'.
-- Bruges af syncMatchScores til at trigge calculateRoundPoints.
CREATE OR REPLACE FUNCTION get_rounds_needing_calc()
RETURNS TABLE(id integer) AS $$
  SELECT DISTINCT r.id
  FROM rounds r
  WHERE r.status != 'finished'
  AND NOT EXISTS (
    SELECT 1 FROM matches m
    WHERE m.season_id = r.season_id
    AND m.round_name = r.name
    AND m.status != 'finished'
  )
  AND EXISTS (
    SELECT 1 FROM bets b
    JOIN matches m ON m.id = b.match_id
    WHERE m.season_id = r.season_id
    AND m.round_name = r.name
    AND b.stake > 0
  )
$$ LANGUAGE sql;
