-- 1. UNIQUE constraints to prevent duplicate memberships
ALTER TABLE game_members
ADD CONSTRAINT game_members_game_user_unique
UNIQUE (game_id, user_id);

ALTER TABLE round_members
ADD CONSTRAINT round_members_user_round_game_unique
UNIQUE (user_id, round_id, game_id);

-- 2. NOT NULL on critical bets columns
ALTER TABLE bets
ALTER COLUMN prediction SET NOT NULL,
ALTER COLUMN bet_type SET NOT NULL,
ALTER COLUMN stake SET NOT NULL;
