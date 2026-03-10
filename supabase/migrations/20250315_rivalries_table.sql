-- Rivalry multiplier (×1.5) on specific matches between rival teams
--
-- IMPORTANT: home_team and away_team must match league_matches team name strings
-- exactly (home_team, away_team in league_matches). Matches are synced from
-- league_matches, so use the same canonical names to ensure rivalry lookups work.

CREATE TABLE IF NOT EXISTS rivalries (
  id serial PRIMARY KEY,
  league_id integer NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  home_team text NOT NULL,
  away_team text NOT NULL,
  rivalry_name text NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, home_team, away_team)
);
