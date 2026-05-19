-- Games: is_free_event flag (2026-05-14)
--
-- Flag der gør et spilrum gratis at deltage i uden Stripe-subscription.
-- Bruges til engangs-events som VM 2026 i USA/Canada/Mexico hvor vi vil
-- bruge åbne spilrum som akkvisitions-kanal.
--
-- Effekt:
--   - proxy.ts (paywall) lader brugere uden subscription tilgå /games/<id>
--     hvis det spil har is_free_event=true
--   - gameroom-siden viser en "bliv-medlem" pitch-banner for free-event-
--     brugere så de kan konvertere efter eventet
--   - admin Games-tab har en toggle til at sætte flag'et

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS is_free_event boolean NOT NULL DEFAULT false;

-- Index så paywall-tjek i proxy.ts er hurtigt (kun få free_event-spil
-- forventes ad gangen, men indekseret er det O(log n) opslag)
CREATE INDEX IF NOT EXISTS games_is_free_event_idx
  ON games (is_free_event)
  WHERE is_free_event = true;
