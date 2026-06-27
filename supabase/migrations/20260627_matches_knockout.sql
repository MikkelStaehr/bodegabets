-- Knockout-fasen (VM-slutspil): ekstra-bets for forlænget/straffe + 🔥 on-fire-kamp.
--
-- Knockout-kampe kan ikke ende uafgjort. Vælger en spiller X (uafgjort efter
-- ordinær tid → forlænget), folder to ekstra-valg sig ud: hvem går videre, og
-- om det afgøres i forlænget spilletid eller på straffe.
--
-- VIGTIGT om datakilden: Bold-API'et giver kun slutresultat + status_type
-- (finished/inprogress), IKKE en FT/AET/Pen-kode. Slutresultatet inkluderer
-- forlænget spilletid, så vi kan ikke automatisk udlede 90-min-resultatet eller
-- om kampen gik i forlænget/straffe. Derfor afgøres knockout-udfaldet
-- ADMIN-styret (ko_resolved gates scoring): indtil en admin bekræfter udfaldet
-- forbliver kampens bets pending og scores ikke. ko_advanced for forlænget kan
-- admin udlede af slutresultatet; for straffe indtastes vinderen manuelt.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_knockout       boolean     NOT NULL DEFAULT false,
  -- ko_method: hvordan kampen blev afgjort UD OVER ordinær tid.
  --   null = afgjort i ordinær tid (ingen forlænget/straffe)
  --   'et' = forlænget spilletid (extra time)
  --   'pen' = straffespark
  ADD COLUMN IF NOT EXISTS ko_method         text,
  -- ko_advanced: hvem gik videre. '1' = hjemme, '2' = ude.
  ADD COLUMN IF NOT EXISTS ko_advanced       text,
  -- ko_resolved: admin (eller sync, hvis Bold engang eksponerer det) har bekræftet
  -- knockout-udfaldet. Gater scoring — uden den forbliver kampens bets pending.
  ADD COLUMN IF NOT EXISTS ko_resolved       boolean     NOT NULL DEFAULT false,
  -- 🔥 on-fire: én tilfældig knockout-kamp pr. blok giver dobbelt odds. Sættes
  -- når blokken åbner; nulstilles aldrig for spillede blokke.
  ADD COLUMN IF NOT EXISTS is_on_fire        boolean     NOT NULL DEFAULT false,
  -- Tidsstempel for hvornår on-fire blev sat — bruges til at detektere at en blok
  -- allerede er behandlet, så vi ikke vælger en ny on-fire-kamp ved hver cron-kørsel.
  ADD COLUMN IF NOT EXISTS is_on_fire_set_at timestamptz;

-- Konsistens-constraints (defensive — UI + server validerer også).
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_ko_method_check,
  ADD  CONSTRAINT matches_ko_method_check   CHECK (ko_method   IS NULL OR ko_method   IN ('et', 'pen'));
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_ko_advanced_check,
  ADD  CONSTRAINT matches_ko_advanced_check CHECK (ko_advanced IS NULL OR ko_advanced IN ('1', '2'));

-- Hurtig opslag af en bloks knockout-/on-fire-kampe.
CREATE INDEX IF NOT EXISTS matches_is_knockout_idx ON matches (is_knockout) WHERE is_knockout;

-- Backfill: markér eksisterende knockout-kampe ud fra rundenavnet. Alle 32
-- slutspilskampe findes allerede (med pladsholder-hold som "2A v 2B"), så denne
-- ene UPDATE dækker hele knockout-fasen. Rundenavne ser ud som "1/16-finale ·
-- 28. jun", "Kvartfinale · 9. jul" osv. (gruppespil starter med "Gruppespil").
--
-- VIGTIGT: scopet til VM-sæsonen (season_id = 25). De nye knockout-felter driver
-- en VM-SPECIFIK scoring (admin-afgjort, pending til ko_resolved). Andre turneringer
-- (CL/EL m.fl.) bruger ALTID "1/16-finale" som rundenavn og scores på slutresultatet
-- som hidtil — de må IKKE flagges, ellers ville deres bets ende pending.
UPDATE matches m
SET is_knockout = true
FROM rounds r
WHERE m.round_id = r.id
  AND m.season_id = 25
  AND r.name ~* '^(1/16-finale|Ottendedelsfinale|Kvartfinale|Semifinale|Bronzekamp|Finale)';
