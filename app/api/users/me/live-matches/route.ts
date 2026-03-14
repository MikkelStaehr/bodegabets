/**
 * GET /api/users/me/live-matches
 * Henter alle live- og kommende kampe på tværs af alle spilrum brugeren er med i.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: memberships } = await supabaseAdmin
    .from('game_members')
    .select('game_id')
    .eq('user_id', user.id)

  const gameIds = [...new Set((memberships ?? []).map((m) => m.game_id))]
  if (gameIds.length === 0) return NextResponse.json({ leagues: [] })

  const { data: gameLeagues } = await supabaseAdmin
    .from('game_leagues')
    .select('league_id')
    .in('game_id', gameIds)

  const leagueIds = [...new Set((gameLeagues ?? []).map((gl) => gl.league_id))]
  if (leagueIds.length === 0) return NextResponse.json({ leagues: [] })

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, league_id')
    .in('league_id', leagueIds)
    .in('status', ['open', 'active', 'upcoming'])

  const roundIds = (rounds ?? []).map((r) => r.id)
  if (roundIds.length === 0) return NextResponse.json({ leagues: [] })

  const now = new Date()
  const soon = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, round_id, home_team, away_team, home_score, away_score, home_score_ht, away_score_ht, status, kickoff_at')
    .in('round_id', roundIds)
    .in('status', ['live', 'halftime', 'finished', 'scheduled'])
    .gte('kickoff_at', since.toISOString())
    .lte('kickoff_at', soon.toISOString())
    .order('kickoff_at', { ascending: true })
    .limit(50)

  const matchIds = (matches ?? []).map((m) => m.id)
  let betsByMatch: Record<number, { prediction: string; result: string | null }> = {}
  if (matchIds.length > 0) {
    const { data: bets } = await supabaseAdmin
      .from('bets')
      .select('match_id, prediction, result')
      .eq('user_id', user.id)
      .in('match_id', matchIds)
    betsByMatch = Object.fromEntries(
      (bets ?? []).map((b) => [b.match_id, { prediction: b.prediction ?? '', result: b.result ?? null }])
    )
  }

  const roundIdsFromMatches = [...new Set((matches ?? []).map((m) => m.round_id))]
  const { data: roundRows } = await supabaseAdmin
    .from('rounds')
    .select('id, league_id')
    .in('id', roundIdsFromMatches)
  const leagueIdsFromRounds = [...new Set((roundRows ?? []).map((r) => r.league_id))]
  const { data: leagueRows } = leagueIdsFromRounds.length > 0
    ? await supabaseAdmin.from('leagues').select('id, name').in('id', leagueIdsFromRounds)
    : { data: [] }
  const leagueNameById = new Map((leagueRows ?? []).map((l) => [l.id, l.name]))
  const leagueIdByRound = new Map((roundRows ?? []).map((r) => [r.id, r.league_id]))

  const byLeague: Record<number, { league_id: number; league_name: string; matches: unknown[] }> = {}
  for (const m of matches ?? []) {
    const leagueId = leagueIdByRound.get(m.round_id) ?? 0
    const leagueName = leagueNameById.get(leagueId) ?? 'Ukendt'

    if (!byLeague[leagueId]) {
      byLeague[leagueId] = { league_id: leagueId, league_name: leagueName, matches: [] }
    }
    byLeague[leagueId].matches.push({
      ...m,
      bet: betsByMatch[m.id] ?? null,
    })
  }

  return NextResponse.json({ leagues: Object.values(byLeague) })
}
