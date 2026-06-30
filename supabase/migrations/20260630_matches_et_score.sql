-- Knockout: gem resultatet EFTER FORLÆNGET SPILLETID (før straffene).
--
-- Bold folder straffescoren ind i home_score/away_score (fx 1-1 på banen → Bold
-- viser 4-5 når straffene 3-4 lægges oveni). For at vise det rigtige resultat
-- ("1-1 · STR 3-4") gemmer vi løbende scoren mens minut ≤ 120 (forlænget-
-- resultatet). Straffescoren udledes så som slut − forlænget.
--
-- Kun relevant for straffe-kampe. For ordinær/forlænget-afgjorte kampe er
-- home_score/away_score allerede det rigtige resultat (intet foldet ind).

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS et_home_score integer,
  ADD COLUMN IF NOT EXISTS et_away_score integer;
