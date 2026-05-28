-- ============================================================================
-- Cycling blocks: metadata-rygrad
--   - Eksplicit stage-vindue (stage_number_min/max) i stedet for at parse navnet
--   - Dato-vindue (starts_at/ends_at) som fallback for ikke-stage-blokke
--   - Persistente vinder-felter sat når blokken lukkes (vi genberegner ikke live)
--   - cycling_block_results: snapshot af standings ved blokens lukning
--     (immutable historik — scoring-fixes bagefter rører ikke en lukket blok)
-- ============================================================================

ALTER TABLE cycling_blocks
  ADD COLUMN IF NOT EXISTS stage_number_min int,
  ADD COLUMN IF NOT EXISTS stage_number_max int,
  ADD COLUMN IF NOT EXISTS starts_at        date,
  ADD COLUMN IF NOT EXISTS ends_at          date,
  ADD COLUMN IF NOT EXISTS winner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_points    numeric,
  ADD COLUMN IF NOT EXISTS finalized_at     timestamptz;

COMMENT ON COLUMN cycling_blocks.stage_number_min IS 'Inkl. nedre etape-grænse for sub-blokke (parses ikke længere fra navnet)';
COMMENT ON COLUMN cycling_blocks.stage_number_max IS 'Inkl. øvre etape-grænse for sub-blokke';
COMMENT ON COLUMN cycling_blocks.starts_at IS 'Dato-vindue start (bruges når stage_number er null, fx månedsblokke)';
COMMENT ON COLUMN cycling_blocks.ends_at IS 'Dato-vindue slut';
COMMENT ON COLUMN cycling_blocks.winner_user_id IS 'Sat når blokken går til finished — null mens blokken er aktiv';
COMMENT ON COLUMN cycling_blocks.winner_points IS 'Vinderens totalpoint snapshot ved lukning';
COMMENT ON COLUMN cycling_blocks.finalized_at IS 'Tidspunkt hvor blokken blev lukket og vinder snapshottet';

-- Indeks til hurtigt at finde aktive sub-blokke pr. parent
CREATE INDEX IF NOT EXISTS cycling_blocks_parent_status_idx
  ON cycling_blocks (parent_block_id, status)
  WHERE parent_block_id IS NOT NULL;

-- ============================================================================
-- cycling_block_results: standings-snapshot ved lukning
-- ============================================================================

CREATE TABLE IF NOT EXISTS cycling_block_results (
  id           bigserial PRIMARY KEY,
  block_id     uuid NOT NULL REFERENCES cycling_blocks(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank         int NOT NULL,
  points       numeric NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, user_id)
);

CREATE INDEX IF NOT EXISTS cycling_block_results_block_idx ON cycling_block_results (block_id, rank);
CREATE INDEX IF NOT EXISTS cycling_block_results_user_idx  ON cycling_block_results (user_id);

COMMENT ON TABLE cycling_block_results IS
  'Immutable snapshot af blok-standings ved lukning. Rank 1 mirror''es til cycling_blocks.winner_user_id.';

-- RLS: public read (alle kan se historik), kun service-role kan skrive
ALTER TABLE cycling_block_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read cycling_block_results" ON cycling_block_results;
CREATE POLICY "Public read cycling_block_results" ON cycling_block_results FOR SELECT USING (true);
