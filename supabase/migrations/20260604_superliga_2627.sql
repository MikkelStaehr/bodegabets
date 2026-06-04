-- ============================================================================
-- Superligaen 2026/27
--
-- Bold-phase-id 24800 fundet via Bold's API (tournament_id=115).
-- Første kamp er 24. juli 2026 (Viborg FF). Standardstruktur: 32 spillerunder.
--
-- Eksisterende Superliga 25/26 (season id 1, phase 24470) forbliver — den
-- afsluttes naturligt med sidste runde, og cycling-archive-check-mønstret
-- spejles til football-archive-check der låser inaktive gamerooms efter
-- sidste runde.
-- ============================================================================

-- 'name' og 'tournament_id' følger samme mønster som 25/26 (se seasons-row 1)
INSERT INTO seasons (tournament_id, name, bold_phase_ids)
SELECT tournament_id, '2026/27', '24800'
FROM seasons
WHERE id = 1
ON CONFLICT DO NOTHING;
