-- Stripe subscriptions (2026-05-11)
--
-- Tilføjer subscription-felter til profiles. Paywall-middleware tjekker
-- subscription_status: kun 'active' eller 'comped' giver adgang.
--
-- subscription_status:
--   none      → ny bruger, ikke betalt endnu
--   active    → Stripe-subscription i 'active' eller 'trialing' state
--   comped    → whitelist (admin har givet gratis adgang)
--   past_due  → betaling fejlede, Stripe forsøger igen
--   canceled  → subscription afsluttet, adgang fjernet

ALTER TABLE profiles
  ADD COLUMN subscription_status text NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'comped', 'past_due', 'canceled')),
  ADD COLUMN stripe_customer_id text UNIQUE,
  ADD COLUMN stripe_subscription_id text UNIQUE,
  ADD COLUMN subscription_current_period_end timestamptz;

-- Index på stripe_customer_id (webhook-lookup) og status (paywall-check)
CREATE INDEX idx_profiles_stripe_customer_id ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX idx_profiles_subscription_status ON profiles(subscription_status);
