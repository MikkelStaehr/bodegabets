-- UNIQUE constraint for syncMatchesForRound upsert
-- Tillader upsert på (round_id, home_team, away_team)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_round_home_away_unique'
  ) THEN
    ALTER TABLE matches
    ADD CONSTRAINT matches_round_home_away_unique
    UNIQUE (round_id, home_team, away_team);
  END IF;
END $$;
