-- Blocks: 1 season → blocks (4 rounds each) → rounds → matches

CREATE TABLE IF NOT EXISTS blocks (
  id serial PRIMARY KEY,
  game_id integer NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  block_number integer NOT NULL,
  status text NOT NULL DEFAULT 'upcoming', -- upcoming/active/finished
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, block_number)
);
