-- Knockout forenklet: knockout-kampe er nu bare 1/2 ("hvem går videre") og
-- scores automatisk via slutresultatet (Bold giver altid en vinder — straffe-/
-- forlænget-resultatet lægges i scoren). Den admin-afgjorte model (ko_method/
-- ko_advanced/ko_resolved) er fjernet fra koden. Disse kolonner er nu ubrugte.
--
-- is_knockout (skjuler X) + is_on_fire/is_on_fire_set_at (🔥-kampen) BEHOLDES.

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_ko_method_check,
  DROP CONSTRAINT IF EXISTS matches_ko_advanced_check,
  DROP COLUMN IF EXISTS ko_method,
  DROP COLUMN IF EXISTS ko_advanced,
  DROP COLUMN IF EXISTS ko_resolved;
