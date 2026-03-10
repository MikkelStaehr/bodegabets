/**
 * syncMatchesForRound.ts
 * Populerer matches-tabellen fra league_matches for en given runde.
 * Bruges når bet-siden åbnes og der ingen matches er, samt ved oprettelse af nyt spilrum.
 * Bruger altid supabaseAdmin (service role) for skriveadgang.
 */

import { supabaseAdmin } from '@/lib/supabase'

export async function syncMatchesForRound(
  _supabase: unknown,
  gameId: number,
  roundId: number
): Promise<void> {
  console.log('[syncMatchesForRound] gameId:', gameId, 'roundId:', roundId)

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('league_id')
    .eq('id', gameId)
    .single()

  console.log('[syncMatchesForRound] league_id:', game?.league_id)

  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('name')
    .eq('id', roundId)
    .eq('game_id', gameId)
    .single()

  console.log('[syncMatchesForRound] round name:', round?.name)

  if (!game?.league_id || !round?.name) {
    console.log('[syncMatchesForRound] early return: missing game.league_id or round.name')
    return
  }

  const { data: leagueMatches } = await supabaseAdmin
    .from('league_matches')
    .select('id, home_team, away_team, kickoff_at, status, home_score, away_score')
    .eq('league_id', game.league_id)
    .eq('round_name', round.name)
    .order('kickoff_at', { ascending: true })

  console.log('[syncMatchesForRound] leagueMatches count:', leagueMatches?.length)

  if (!leagueMatches?.length) {
    console.log('[syncMatchesForRound] early return: no league matches')
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
    source_url: null,
  }))

  console.log('[syncMatchesForRound] rows[0]:', JSON.stringify(rows[0]))

  const { data: upsertData, error: upsertError } = await supabaseAdmin
    .from('matches')
    .upsert(rows, { onConflict: 'round_id,home_team,away_team' })
    .select()

  if (upsertError) {
    console.error('[syncMatchesForRound] upsert error:', JSON.stringify(upsertError, null, 2))
  }
  console.log('[syncMatchesForRound] upsert result:', { data: upsertData, error: upsertError })
}
