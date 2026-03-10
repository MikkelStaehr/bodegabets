-- bold_match_id på league_matches til Bold API-matching (syncBoldFixtures, syncResults)
ALTER TABLE public.league_matches
ADD COLUMN IF NOT EXISTS bold_match_id bigint;

COMMENT ON COLUMN public.league_matches.bold_match_id IS 'Bold.dk kamp-ID fra aggregator API';
