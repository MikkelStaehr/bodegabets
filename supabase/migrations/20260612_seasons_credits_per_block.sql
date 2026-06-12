-- Slutrunde-credit-model: 1000 credits PR. BLOK (delt over blokkens runder),
-- i stedet for pr. runde. Bruges af VM/slutrunder hvor 2 spillerunder = 1 blok.
-- Default false = uændret pr-runde-model (almindelig sæson-fodbold).
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS credits_per_block boolean NOT NULL DEFAULT false;

-- VM 2026 (season 25) kører blok-budget.
UPDATE seasons SET credits_per_block = true WHERE id = 25;
