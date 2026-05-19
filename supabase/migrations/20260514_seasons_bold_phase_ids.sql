-- Seasons: bold_phase_ids (plural, text) for multi-phase turneringer (2026-05-14)
--
-- VM 2026 og lignende internationale turneringer (EM, Copa America, Africa Cup)
-- splittes af Bold op i flere phase_ids — én pr. gruppe + én pr. knockout-runde.
-- VM 2026 fx: 22620, 22621, 22622, 22623, ..., 22632 (13 phase_ids total).
--
-- For at undgå at røre den eksisterende bold_phase_id (integer) tilføjer vi
-- en parallel tekst-kolonne. Sync-koden bruger bold_phase_ids hvis sat, ellers
-- falder den tilbage til bold_phase_id. Eksisterende Premier League/Bundesliga
-- osv. forbliver fuldstændig uændrede.
--
-- Format: komma-separeret string af phase_ids, fx "22620,22621,22622,22623"
-- Bold API'et accepterer formatet direkte i ?phase_ids= parameteret.

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS bold_phase_ids text;

COMMENT ON COLUMN seasons.bold_phase_ids IS
  'Komma-separeret liste af Bold phase_ids til multi-phase turneringer (VM, EM osv). Tager forrang over bold_phase_id når sat.';
