-- Tilføj bold_match_id til matches for Bold API-matching
-- Kør i Supabase SQL Editor før matchBoldIds.ts

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS bold_match_id bigint;

COMMENT ON COLUMN public.matches.bold_match_id IS 'Bold.dk kamp-ID fra aggregator API';
