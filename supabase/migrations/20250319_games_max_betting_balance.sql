-- games.max_betting_balance: max credits per runde (default 1000)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS max_betting_balance integer NOT NULL DEFAULT 1000;
