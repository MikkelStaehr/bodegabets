-- Tiebreaker tracking for extra bets

ALTER TABLE round_scores
  ADD COLUMN IF NOT EXISTS extra_bets_correct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_delta integer NOT NULL DEFAULT 0;
