-- Log af Bold match-matching kørsler
-- Kør i Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.bold_match_logs (
  id serial primary key,
  ran_at timestamptz not null default now(),
  matches_matched int not null default 0,
  details jsonb,
  status text not null default 'ok',
  error_message text
);

COMMENT ON TABLE public.bold_match_logs IS 'Log af match-bold-ids kørsler';
