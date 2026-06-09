-- ============================================================================
-- Udvid cycling_stages.profile CHECK-constraint med 'ttt' (og 'itt')
--
-- Hold-tempo-etaper (TTT) får egen profil så scoringen ved det er en
-- holdpræstation (basispoint = holdets placering, ingen klatre/spurt-bonus).
-- Den eksisterende CHECK-constraint tillod kun terræn-profilerne, så et
-- forsøg på at sætte profile='ttt' fejlede med
-- "violates check constraint cycling_stages_profile_check".
--
-- 'itt' (individuel enkeltstart) tilføjes samtidig — UI'et refererer den
-- allerede (PROFILE_LABELS), og det er konsistent at tillade den.
-- ============================================================================

ALTER TABLE cycling_stages
  DROP CONSTRAINT IF EXISTS cycling_stages_profile_check;

ALTER TABLE cycling_stages
  ADD CONSTRAINT cycling_stages_profile_check
  CHECK (profile IS NULL OR profile IN (
    'flat', 'hilly', 'mountain', 'mixed', 'cobbled', 'itt', 'ttt'
  ));
