-- ============================================================================
-- Udbruds-bonus (km_in_break)
--
-- PCS markerer udbryderne på en etape med et rødt "svg_shield"-ikon hvis
-- title-attribut angiver hvor langt rytteren var fremme, fx:
--   <div title="169 kilometre in a group in front of the peloton" class="svg_shield">
--
-- Vi belønner det: ryttere der stikker af (også de fangne) får point selv uden
-- top-20. Bonussen tilfalder KUN de tre roller der ellers ofte scorer 0 —
-- Domestique, Équipier og Joker (roleMul ×1.0) — og beregnes som km × 0.1.
-- ============================================================================

-- 1) Per-rytter, per-etape udbruds-km
ALTER TABLE cycling_results
  ADD COLUMN IF NOT EXISTS km_in_break int NOT NULL DEFAULT 0;

COMMENT ON COLUMN cycling_results.km_in_break IS
  'Antal km rytteren var i udbrud foran feltet på etapen (fra PCS'' svg_shield-ikon). 0 = ikke i udbrud.';

-- 2) break_points på score-rækken + genskab total_points-formelen
ALTER TABLE cycling_scores DROP COLUMN IF EXISTS total_points;

ALTER TABLE cycling_scores
  ADD COLUMN IF NOT EXISTS break_points numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN cycling_scores.break_points IS
  'Udbruds-bonus: km_in_break × 0.1. Kun Domestique/Équipier/Joker. Belønner angreb selv uden top-20-placering.';

ALTER TABLE cycling_scores
  ADD COLUMN total_points numeric GENERATED ALWAYS AS (
    (base_points * role_multiplier * gc_multiplier)
    + role_bonus
    + jersey_points
    + team_bonus
    + intermediate_points
    + break_points
  ) STORED;

COMMENT ON COLUMN cycling_scores.total_points IS
  'Beregnet automatisk: base × role_mul × gc_mul + role_bonus + jersey_points + team_bonus + intermediate_points + break_points. Ingen straffe.';
