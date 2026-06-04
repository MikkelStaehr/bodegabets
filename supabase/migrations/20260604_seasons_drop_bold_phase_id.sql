-- ============================================================================
-- Seasons: drop legacy bold_phase_id-kolonne
--
-- Alle sæsoner er nu migreret til bold_phase_ids (text-format). Den gamle
-- single-int kolonne kan droppes — koden bruger udelukkende bold_phase_ids.
--
-- Manual SQL kørt mod prod før denne migration:
--   UPDATE seasons SET bold_phase_ids = bold_phase_id::text
--   WHERE bold_phase_id IS NOT NULL AND (bold_phase_ids IS NULL OR bold_phase_ids LIKE '{%');
--
-- DB-audit bekræftet 19/19 sæsoner har bold_phase_ids udfyldt korrekt.
-- ============================================================================

ALTER TABLE seasons DROP COLUMN IF EXISTS bold_phase_id;
