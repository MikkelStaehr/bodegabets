/**
 * syncMatchesForRound.ts
 * Populerer matches-tabellen fra league_matches for en given runde.
 * Bruges når bet-siden åbnes og der ingen matches er, samt ved oprettelse af nyt spilrum.
 * Bruger altid supabaseAdmin (service role) for skriveadgang.
 */

import { supabaseAdmin } from '@/lib/supabase'

export async function syncMatchesForRound(
  gameId: number,
  roundId: number
): Promise<void> {
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('name, league_id')
    .eq('id', roundId)
    .single()

  if (!round?.league_id || !round?.name) {
    return
  }

  const { data: leagueMatches } = await supabaseAdmin
    .from('league_matches')
    .select('id, home_team, away_team, kickoff_at, status, home_score, away_score')
    .eq('league_id', round.league_id)
    .eq('round_name', round.name)
    .order('kickoff_at', { ascending: true })

  if (!leagueMatches?.length) {
    return
  }

  const rows = leagueMatches.map((lm) => ({
    round_id: roundId,
    league_match_id: lm.id,
    home_team: lm.home_team,
    away_team: lm.away_team,
    kickoff_at: lm.kickoff_at,
    status: lm.status ?? 'scheduled',
    home_score: lm.home_score ?? null,
    away_score: lm.away_score ?? null,
  }))

  const { error: upsertError } = await supabaseAdmin
    .from('matches')
    .upsert(rows, { onConflict: 'round_id,home_team,away_team' })
    .select()

  if (upsertError) {
    console.error('[syncMatchesForRound] upsert fejl:', upsertError.message)
  }
}
