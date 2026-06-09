-- ============================================================================
-- Etape-klatringer fra PCS
--
-- PCS' stage-side lister hver klatring med navn, længde, gradient og position
-- (km fra start). Vi scraper det og gemmer som JSONB-array, så vi kan rendere
-- en mere præcis profil-silhuet i lineup-builderen.
--
-- Format pr. element:
--   { name, length_km, gradient_pct, km_from_start?, category? }
-- ============================================================================

ALTER TABLE cycling_stages
  ADD COLUMN IF NOT EXISTS climbs jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN cycling_stages.climbs IS
  'Liste af klatringer fra PCS stage-page. Array af {name, length_km, gradient_pct, km_from_start?, category?}. Tom array hvis ingen klatringer eller scrape fejlede.';
