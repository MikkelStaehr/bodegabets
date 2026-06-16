-- Blok Bets — overordnede bets der spænder over HELE blokken (alle blokkens
-- kampe samlet), i stedet for en enkelt kamp. Lægges ved blok-start og afgøres
-- når blokken er færdig. Indsatsen deler det samme blok-budget (1000) som
-- kamp-bets. Markeder + odds defineres i lib/blockBets.ts.

CREATE TABLE IF NOT EXISTS block_bets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id     integer NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  game_id      integer NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  market_key   text NOT NULL,                       -- fx 'goals_ou', 'big_game'
  selection    text NOT NULL,                       -- fx 'over' | 'under' | 'yes' | 'no'
  stake        integer NOT NULL CHECK (stake >= 0),
  odds         numeric NOT NULL,
  result       text NOT NULL DEFAULT 'pending',     -- 'pending' | 'win' | 'loss'
  points_earned integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Ét bet pr. marked pr. bruger pr. blok (man kan ændre sit valg, ikke stable
  -- to modsatte sider af samme marked).
  UNIQUE (block_id, game_id, user_id, market_key)
);

CREATE INDEX IF NOT EXISTS block_bets_block_game_idx ON block_bets (block_id, game_id);
CREATE INDEX IF NOT EXISTS block_bets_user_idx ON block_bets (user_id, game_id);
