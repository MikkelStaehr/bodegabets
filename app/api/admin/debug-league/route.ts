import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

/** Midlertidigt debug-endpoint: tjekker league_matches, games, rounds, matches for en liga. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const leagueId = parseInt(req.nextUrl.searchParams.get('league_id') ?? '4', 10)

  const [
    { data: leagueMatches, count: lmCount },
    { data: games },
    { data: league },
  ] = await Promise.all([
    supabaseAdmin
      .from('league_matches')
      .select('id, round_name, home_team, away_team', { count: 'exact' })
      .eq('league_id', leagueId)
      .limit(5),
    supabaseAdmin
      .from('games')
      .select('id, name, league_id, status, created_at')
      .eq('league_id', leagueId),
    supabaseAdmin
      .from('leagues')
      .select('id, name, fixturedownload_slug, bold_slug, bold_phase_id')
      .eq('id', leagueId)
      .single(),
  ])

  let rounds: unknown[] = []
  let matches: unknown[] = []
  const gameIds = (games ?? []).map((g: { id: number }) => g.id)
  let totalRounds = 0
  let totalMatches = 0

  if (gameIds.length > 0) {
    const { data: roundsData, count: roundsCount } = await supabaseAdmin
      .from('rounds')
      .select('id, game_id, name, league_id', { count: 'exact' })
      .in('game_id', gameIds)
    rounds = roundsData ?? []
    totalRounds = roundsCount ?? 0
    const roundIds = (roundsData ?? []).map((r: { id: number }) => r.id)
    if (roundIds.length > 0) {
      const { data: matchesData, count: matchesCount } = await supabaseAdmin
        .from('matches')
        .select('id, round_id, home_team, away_team', { count: 'exact' })
        .in('round_id', roundIds)
      matches = matchesData ?? []
      totalMatches = matchesCount ?? 0
    }
  }

  return NextResponse.json({
    league_id: leagueId,
    league: league ?? null,
    league_matches: { count: lmCount ?? 0, sample: leagueMatches ?? [] },
    games: games ?? [],
    rounds: { count: totalRounds, sample: rounds },
    matches: { count: totalMatches, sample: matches },
  })
}
