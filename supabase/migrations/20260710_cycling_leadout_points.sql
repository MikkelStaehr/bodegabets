-- ============================================================================
-- Leadout-bonus (spurt-tog)
--
-- En leadout-equipier (equipier fra sprinterens hold) fik hidtil INGEN belønning
-- for at trække sprinteren frem — kun almindelig holdbonus. Det gjorde leadout-
-- slots "døde", så et koordineret spurt-tog scorede det samme som 2 tilfældige
-- point-ryttere. Nu får hver leadout en flad bonus efter sprinterens placering
-- (1→12, 2→8, 3→5) når sprinteren bliver top-3.
-- ============================================================================

ALTER TABLE cycling_scores DROP COLUMN IF EXISTS total_points;

ALTER TABLE cycling_scores
  ADD COLUMN IF NOT EXISTS leadout_points numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN cycling_scores.leadout_points IS
  'Leadout-bonus: equipier fra sprinterens hold, 12/8/5 efter sprinterens placering (kun når sprinter top-3).';

ALTER TABLE cycling_scores
  ADD COLUMN total_points numeric GENERATED ALWAYS AS (
    (base_points * role_multiplier * gc_multiplier)
    + role_bonus
    + jersey_points
    + team_bonus
    + intermediate_points
    + break_points
    + leadout_points
  ) STORED;

COMMENT ON COLUMN cycling_scores.total_points IS
  'Beregnet automatisk: base × role_mul × gc_mul + role_bonus + jersey_points + team_bonus + intermediate_points + break_points + leadout_points. Ingen straffe.';
