-- Tilføj bold_match_id til league_matches for præcis Bold API-matching i syncResults
-- Kør i Supabase SQL Editor

ALTER TABLE public.league_matches
ADD COLUMN IF NOT EXISTS bold_match_id bigint;

COMMENT ON COLUMN public.league_matches.bold_match_id IS 'Bold.dk kamp-ID fra aggregator API';
