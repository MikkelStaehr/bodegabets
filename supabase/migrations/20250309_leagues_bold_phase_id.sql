-- bold_phase_id: Bold.dk phase/sæson-ID til live-score API
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS bold_phase_id integer;

COMMENT ON COLUMN public.leagues.bold_phase_id IS 'Bold.dk phase ID til live-score API (team_ids + phase_ids)';

UPDATE public.leagues SET bold_phase_id = 23535 WHERE id = 1;  -- Premier League
UPDATE public.leagues SET bold_phase_id = 24470 WHERE id = 2;  -- Superligaen
UPDATE public.leagues SET bold_phase_id = 23634 WHERE id = 3;  -- La Liga
UPDATE public.leagues SET bold_phase_id = 23474 WHERE id = 4;  -- Bundesliga
UPDATE public.leagues SET bold_phase_id = 23497 WHERE id = 5;  -- Serie A
UPDATE public.leagues SET bold_phase_id = 23615 WHERE id = 6;  -- Ligue 1
UPDATE public.leagues SET bold_phase_id = 23844 WHERE id = 7;  -- UCL
