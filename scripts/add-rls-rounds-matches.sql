-- RLS for rounds og matches
-- Kør i Supabase SQL Editor hvis du ikke kan se kampe på runde-siden.
--
-- Årsag: Uden policies blokerer RLS alle læsninger for normale brugere.
-- Løsning: Tillad SELECT for brugere der er medlem af spillet.

-- Rounds: medlemmer af et spil kan læse runder for det spil
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read rounds" ON public.rounds;
CREATE POLICY "Members can read rounds" ON public.rounds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_members gm
      WHERE gm.game_id = rounds.game_id
        AND gm.user_id = auth.uid()
    )
  );

-- Matches: medlemmer af et spil kan læse kampe i runder for det spil
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read matches" ON public.matches;
CREATE POLICY "Members can read matches" ON public.matches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.game_members gm ON gm.game_id = r.game_id
      WHERE r.id = matches.round_id
        AND gm.user_id = auth.uid()
    )
  );
