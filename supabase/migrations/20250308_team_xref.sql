-- team_xref: mapping fra BB holdnavn til Bold.dk team ID og tournament ID
-- Bruges til at matche hold fra league_matches med Bold API

CREATE TABLE IF NOT EXISTS public.team_xref (
  id serial primary key,
  league_id integer not null references public.leagues(id) on delete cascade,
  bb_team_name text not null,
  bold_team_id integer,
  bold_tournament_id integer,
  unique(league_id, bb_team_name)
);

CREATE INDEX IF NOT EXISTS idx_team_xref_league ON public.team_xref(league_id);
CREATE INDEX IF NOT EXISTS idx_team_xref_bold_team ON public.team_xref(bold_team_id) WHERE bold_team_id IS NOT NULL;

COMMENT ON TABLE public.team_xref IS 'Mapping BB holdnavn → Bold.dk team ID og tournament ID per liga';

-- Populér fra league_matches: distinkte hold per liga (home_team + away_team)
INSERT INTO public.team_xref (league_id, bb_team_name, bold_team_id, bold_tournament_id)
SELECT DISTINCT league_id, team_name, NULL, NULL
FROM (
  SELECT league_id, home_team AS team_name FROM public.league_matches
  UNION
  SELECT league_id, away_team AS team_name FROM public.league_matches
) u
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_xref tx
  WHERE tx.league_id = u.league_id AND tx.bb_team_name = u.team_name
);
