-- ============================================================================
-- TTT holdorden (officielt holdtids-resultat)
--
-- På en TTT vindes etapen på HOLDTID (taget ved 5. rytter), ikke individuel
-- tid. Vores cycling_results.position er den individuelle klassement (fx
-- Baudin/EF hurtigst som enkeltperson), som IKKE afspejler holdresultatet
-- (Visma vandt holdtempoet). Scoringen rangerede derfor hold forkert.
--
-- Vi scraper nu PCS' "TeamTime"-resultat (stage-specifik teams-tabel) og
-- gemmer den officielle holdorden her som et ordnet array af holdnavne:
--   ["Team Visma | Lease a Bike", "Netcompany INEOS", "EF Education...", ...]
-- calculateCyclingPoints bruger den til TTT-basispoint (holdrang → point).
-- ============================================================================

ALTER TABLE cycling_stages
  ADD COLUMN IF NOT EXISTS ttt_team_order jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN cycling_stages.ttt_team_order IS
  'Ordnet array af holdnavne efter officiel TTT-holdtid (1. plads først). Kun udfyldt for TTT-etaper. Bruges af scoring til holdrang.';
