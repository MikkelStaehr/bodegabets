-- Admin logs for monitoring
CREATE TABLE IF NOT EXISTS admin_logs (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL,
  message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_logs_type_created_idx ON admin_logs(type, created_at DESC);

-- Profiles: suspend support
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_reason text;
