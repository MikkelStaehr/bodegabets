-- ============================================================================
-- cycling_stages.start_time_utc — faktisk start-tidspunkt fra PCS
--
-- start_date er hidtil gemt som YYYY-MM-DDT00:00:00Z og deadline-logikken
-- har antaget 13:00 UTC default (15:00 CEST). Det fejlede når PCS' faktiske
-- starttid er fx 11:15 CEST = 09:15 UTC: brugere kunne ændre lineup TIMER
-- efter løbet var startet.
--
-- Ny start_time_utc gemmer den nøjagtige time. getStageDeadline() bruger
-- den hvis sat, falder tilbage til 13:00 UTC default ellers.
-- ============================================================================

ALTER TABLE cycling_stages
  ADD COLUMN IF NOT EXISTS start_time_utc timestamptz;

COMMENT ON COLUMN cycling_stages.start_time_utc IS
  'Nøjagtigt etape-starttidspunkt scraped fra PCS stage-side. Hvis NULL, falder lineup-deadline tilbage til 13:00 UTC default på start_date.';

CREATE INDEX IF NOT EXISTS cycling_stages_start_time_utc_idx
  ON cycling_stages (start_time_utc)
  WHERE start_time_utc IS NOT NULL;
