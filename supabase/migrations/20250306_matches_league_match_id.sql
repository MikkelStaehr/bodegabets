-- league_match_id: reference til league_matches for sync og buildGameRounds
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS league_match_id integer REFERENCES league_matches(id);
