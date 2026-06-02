-- ============================================================================
-- Cycling scores: gem multiplier-breakdown så UI kan vise hvor pointene kommer fra
--
-- role_multiplier består typisk af:
--   cat_multiplier × profile_multiplier × train_multiplier
--
-- (med undtagelser for lieutenant der har sin egen leader-DNF-multiplier, og
-- roller uden multiplier som domestique/equipier/joker hvor alle felter = 1.0).
--
-- At gemme komponenterne separat gør tooltip'en på rytter-point ægte:
--   "Kategori (cat 2) × 1.3"
--   "Profil (sprinter, flat) × 1.8"
--   "Spurt-tog × 1.2 (1 leadout)"
-- ============================================================================

ALTER TABLE cycling_scores
  ADD COLUMN IF NOT EXISTS cat_multiplier     numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS profile_multiplier numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS train_multiplier   numeric NOT NULL DEFAULT 1.0;

COMMENT ON COLUMN cycling_scores.cat_multiplier IS 'Rytterens kategori-multiplikator (cat 1=1.0, cat 2=1.3, cat 3=1.7, cat 4=2.2, cat 5=3.5)';
COMMENT ON COLUMN cycling_scores.profile_multiplier IS 'Etape-profil × rolle (fx sprinter på flat = 1.8, grimpeur på mountain = 1.8). 1.0 hvis rollen ikke har profile-bonus.';
COMMENT ON COLUMN cycling_scores.train_multiplier IS 'Spurt-tog: ×1.2-1.4 hvis sprinter top-3 med leadout-equipiers fra samme hold. 1.0 ellers.';
