-- Fix cycling_results.jersey CHECK constraint (2026-05-13)
--
-- Devlog 2026-05-07 (commit a7f89c3) renamede jersey-DB-værdier fra
-- race-specifikke navne (yellow/green/polka/white) til race-agnostiske
-- (leader/points/mountain/youth). Scraperen og UI'en blev opdateret men
-- CHECK constraint på kolonnen blev ikke. Resultat: alle nye upserts
-- med jersey-felt fejler med 'violates check constraint'.
--
-- Drop den gamle constraint og opret en der matcher den nye værdi-set.

ALTER TABLE cycling_results
  DROP CONSTRAINT IF EXISTS cycling_results_jersey_check;

ALTER TABLE cycling_results
  ADD CONSTRAINT cycling_results_jersey_check
  CHECK (jersey IS NULL OR jersey IN ('leader', 'points', 'mountain', 'youth'));
