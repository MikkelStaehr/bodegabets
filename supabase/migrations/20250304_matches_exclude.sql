ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_excluded boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS excluded_reason text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS excluded_at timestamptz;
