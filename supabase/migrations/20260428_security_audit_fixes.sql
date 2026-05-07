-- Security audit fixes (2026-04-28)
-- Found issues:
--   - cycling_sync_log policy was named "Admin read" but USING was 'true'
--     (effectively public). Restrict to admin only.
--   - cycling_squad_transfers SELECT was 'Public read' — leaked competitors'
--     transfer plans before deadline. Restrict to owner.

-- Fix cycling_sync_log: only admins can read
DROP POLICY IF EXISTS "Admin read" ON cycling_sync_log;

CREATE POLICY IF NOT EXISTS "Only admins can read cycling_sync_log"
  ON cycling_sync_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Fix cycling_squad_transfers: only owner can read own transfers
DROP POLICY IF EXISTS "Public read" ON cycling_squad_transfers;

CREATE POLICY IF NOT EXISTS "Users read own transfers"
  ON cycling_squad_transfers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cycling_squads
      WHERE cycling_squads.id = cycling_squad_transfers.squad_id
        AND cycling_squads.user_id = auth.uid()
    )
  );
