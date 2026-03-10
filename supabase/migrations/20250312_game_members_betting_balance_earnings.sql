-- Add missing columns to game_members
-- betting_balance: reset per round/block for placing bets
-- earnings: accumulative wallet
-- current_streak, total_wins, total_losses: used by calculatePoints

ALTER TABLE game_members
  ADD COLUMN IF NOT EXISTS betting_balance integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS earnings integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_losses integer NOT NULL DEFAULT 0;
