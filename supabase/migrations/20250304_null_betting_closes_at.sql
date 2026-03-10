-- Nulstil forældede betting_closes_at (alle sat til "første kamp minus ~1 time")
-- betting_closes_at er nu NULL — brugeren vælger deadline ved oprettelse af spilrum
UPDATE rounds
SET betting_closes_at = NULL
WHERE betting_closes_at < NOW();
