-- Audit log for admin-handlinger (2026-05-08)
--
-- Sporer hvem der gjorde hvad i admin-panelet og via admin-API endpoints.
-- Bruges til:
--   - Forensics ved utilsigtede ændringer
--   - Compliance ved data-håndtering
--   - Synlighed på admin-aktivitet (egen reflection over hvad jeg har lavet)

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_table text,
  target_id text,
  before jsonb,
  after jsonb,
  metadata jsonb,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Kun admins kan læse audit-loggen
CREATE POLICY "Only admins can read audit_logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Insert sker via supabaseAdmin (bypasser RLS) — ingen INSERT policy nødvendig
