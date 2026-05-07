-- Fix cascade-deletes for FKs til games (2026-04-28)
-- Disse FK'er manglede ON DELETE CASCADE, så sletning af et gameroom
-- kunne fejle med foreign key constraint violation.

-- cycling_scores
ALTER TABLE cycling_scores
  DROP CONSTRAINT IF EXISTS cycling_scores_game_id_fkey,
  ADD CONSTRAINT cycling_scores_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

-- championship_rounds
ALTER TABLE championship_rounds
  DROP CONSTRAINT IF EXISTS championship_rounds_game_id_fkey,
  ADD CONSTRAINT championship_rounds_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

-- game_seasons
ALTER TABLE game_seasons
  DROP CONSTRAINT IF EXISTS game_seasons_game_id_fkey,
  ADD CONSTRAINT game_seasons_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

-- round_members
ALTER TABLE round_members
  DROP CONSTRAINT IF EXISTS round_members_game_id_fkey,
  ADD CONSTRAINT round_members_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
