-- Cycling classification values (2026-05-13)
--
-- Vi gemte før kun position pr. klassifikation. For at vise pointtotaler
-- og tid-gaps i gameroom-klassement-tabellen gemmer vi nu også selve
-- værdi-kolonnen som vi scraper fra PCS' classification-tabeller:
--
--   Points classification:   antal pointscores (int)
--   Mountain classification: KOM-points (int)
--   Youth classification:    tid-gap til ung-leder (sekunder)
--
-- GC-tidsgap computes server-side fra eksisterende time_gap_seconds (sum
-- tværs af stages = approximation af GC-gap til leder), så ingen kolonne
-- nødvendig der.

ALTER TABLE cycling_results
  ADD COLUMN IF NOT EXISTS points_value int,
  ADD COLUMN IF NOT EXISTS mountain_value int,
  ADD COLUMN IF NOT EXISTS youth_gap_seconds int;
