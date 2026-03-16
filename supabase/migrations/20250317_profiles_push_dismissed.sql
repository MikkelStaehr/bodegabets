-- Push notification banner dismissed status (per bruger, på tværs af enheder)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_dismissed boolean DEFAULT false;
