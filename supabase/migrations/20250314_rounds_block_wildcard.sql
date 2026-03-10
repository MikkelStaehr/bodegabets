-- Add block_id, wildcard_match_id and extra_bets_enabled to rounds

ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS block_id integer REFERENCES blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wildcard_match_id integer REFERENCES matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extra_bets_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_rounds_block_id ON rounds(block_id);
