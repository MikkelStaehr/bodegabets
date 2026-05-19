-- Seasons: is_free_event flag (2026-05-14)
--
-- Flytter free-event-konceptet fra games-niveau til seasons-niveau.
-- Hvorfor: VM 2026 er en tryout-kampagne, ikke ét specifikt spilrum.
-- Brugere skal kunne oprette deres EGNE VM-spilrum (med vennegrupper) og
-- alle disse skal være tilgængelige uden subscription.
--
-- Med flag på seasons:
--   - Ét aktivt free-event-sæson åbner alle spilrum bundet til den
--   - Brugere kan oprette ubegrænsede VM-spilrum uden at betale
--   - Premier League, cycling osv. forbliver paywalled
--
-- Paywall-logik (proxy.ts):
--   - /games/<id> tillades hvis spillet har MINDST ÉN free-event sæson
--   - /games/create og /games/join tillades altid (gratis-brugere kan
--     oprette VM-spilrum og joine via invite-kode)
--
-- games.is_free_event-kolonnen fra tidligere migration beholdes som
-- backwards-compat (ingen produktions-data brugte den), men logikken
-- migreres til at læse fra seasons.

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS is_free_event boolean NOT NULL DEFAULT false;

-- Partial index for hurtig paywall-lookup
CREATE INDEX IF NOT EXISTS seasons_is_free_event_idx
  ON seasons (is_free_event)
  WHERE is_free_event = true;

-- Markér VM 2026-sæsonen som free event (allerede oprettet i tidligere migration)
UPDATE seasons SET is_free_event = true WHERE id = 25;
