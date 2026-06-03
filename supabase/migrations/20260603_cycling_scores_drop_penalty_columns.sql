-- ============================================================================
-- Fjern bench_penalty og dnf_penalty fra cycling_scores
--
-- Efter PR #245 sættes begge kolonner altid til 0 (vi har ingen straffe).
-- Dead-code-rydning: fjern kolonnerne fra skemaet og genskab total_points
-- som GENERATED column uden penalty-leddene.
--
-- Bemærk: total_points skal droppes først fordi den GENERATED-formel
-- refererer til de kolonner vi vil fjerne.
-- ============================================================================

ALTER TABLE cycling_scores DROP COLUMN IF EXISTS total_points;
ALTER TABLE cycling_scores DROP COLUMN IF EXISTS bench_penalty;
ALTER TABLE cycling_scores DROP COLUMN IF EXISTS dnf_penalty;

ALTER TABLE cycling_scores
  ADD COLUMN total_points numeric GENERATED ALWAYS AS (
    (base_points * role_multiplier * gc_multiplier)
    + role_bonus
    + jersey_points
    + team_bonus
  ) STORED;

COMMENT ON COLUMN cycling_scores.total_points IS
  'Beregnet automatisk: base × role_mul × gc_mul + role_bonus + jersey_points + team_bonus. Ingen straffe i spillet.';
