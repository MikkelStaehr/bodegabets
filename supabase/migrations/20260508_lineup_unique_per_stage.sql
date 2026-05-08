-- Lineup unique constraint per (squad, stage) — ikke per (squad, race) (2026-05-08)
--
-- Den oprindelige constraint cycling_lineups_squad_id_race_id_key kunne kun
-- håndtere ét lineup per (squad, race). Det er korrekt for one-day løb men
-- forkert for stage races (Giro, Tour, Vuelta) hvor hver squad skal have ét
-- lineup per stage.
--
-- Symptom: når squad havde gemt et lineup på Etape 1 i Giro, fejlede forsøg
-- på at gemme på Etape 2 med 'duplicate key value violates unique constraint
-- "cycling_lineups_squad_id_race_id_key"'.
--
-- Fix: drop den gamle constraint og lav en ny på (squad_id, stage_id).
-- Verificeret at alle eksisterende cycling_lineups rows har stage_id != NULL.

ALTER TABLE cycling_lineups
  DROP CONSTRAINT IF EXISTS cycling_lineups_squad_id_race_id_key;

ALTER TABLE cycling_lineups
  ADD CONSTRAINT cycling_lineups_squad_id_stage_id_key UNIQUE (squad_id, stage_id);
