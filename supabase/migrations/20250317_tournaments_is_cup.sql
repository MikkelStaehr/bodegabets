-- Tilføj is_cup kolonne til tournaments for at skelne cups fra ligaer
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_cup boolean DEFAULT false;

UPDATE tournaments SET is_cup = true
WHERE name IN ('UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League');
