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

  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .in('game_id', gameIds)

  const seasonIds = [...new Set((gameSeasons ?? []).map((gs) => gs.season_id))]
  if (seasonIds.length === 0) return NextResponse.json({ leagues: [] })

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id, name')
    .in('season_id', seasonIds)
    .in('status', ['open', 'active', 'upcoming'])

  if (!rounds?.length) return NextResponse.json({ leagues: [] })

  const now = new Date()
  const soon = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select(`
      id, season_id, round_name, home_team_id, away_team_id,
      home_score, away_score, home_score_ht, away_score_ht,
      status, kickoff,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name)
    `)
    .in('season_id', seasonIds)
    .in('status', ['live', 'halftime', 'finished', 'scheduled'])
    .gte('kickoff', since.toISOString())
    .lte('kickoff', soon.toISOString())
    .order('kickoff', { ascending: true })
    .limit(50)

  const roundBySeasonName = new Map<string, { id: number; season_id: number }>()
  for (const r of rounds) {
    roundBySeasonName.set(`${r.season_id}|${r.name}`, { id: r.id, season_id: r.season_id })
  }
  const relevantMatches = (matches ?? []).filter((m) =>
    roundBySeasonName.has(`${(m as { season_id: number }).season_id}|${(m as { round_name: string }).round_name}`)
  )

  const matchIds = relevantMatches.map((m) => m.id)
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

  const roundIdsFromMatches = [...new Set(relevantMatches.map((m) => {
    const r = roundBySeasonName.get(`${(m as { season_id: number }).season_id}|${(m as { round_name: string }).round_name}`)
    return r?.id ?? 0
  }))].filter((id) => id !== 0)
  const { data: roundRows } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id')
    .in('id', roundIdsFromMatches)

  const seasonIdsFromRounds = [...new Set((roundRows ?? []).map((r) => r.season_id))]
  const { data: seasonRows } = seasonIdsFromRounds.length > 0
    ? await supabaseAdmin
        .from('seasons')
        .select('id, tournament_id, tournaments(name)')
        .in('id', seasonIdsFromRounds)
    : { data: [] }

  const leagueNameBySeason = new Map<number, string>()
  const tournamentIdBySeason = new Map<number, number>()
  for (const s of seasonRows ?? []) {
    const t = (s as { tournaments?: { name?: string } | { name?: string }[]; tournament_id?: number }).tournaments
    const name = (Array.isArray(t) ? t[0] : t)?.name ?? 'Ukendt'
    leagueNameBySeason.set(s.id as number, name)
    tournamentIdBySeason.set(s.id as number, (s as { tournament_id?: number }).tournament_id ?? 0)
  }
  const seasonIdByRound = new Map((roundRows ?? []).map((r) => [r.id, r.season_id]))

  const byLeague: Record<number, { league_id: number; league_name: string; matches: unknown[] }> = {}
  for (const m of relevantMatches) {
    const roundInfo = roundBySeasonName.get(`${(m as { season_id: number }).season_id}|${(m as { round_name: string }).round_name}`)
    const seasonId = roundInfo?.season_id ?? 0
    const leagueName = leagueNameBySeason.get(seasonId) ?? 'Ukendt'
    const tournamentId = tournamentIdBySeason.get(seasonId) ?? seasonId

    const ht = (m as { home_team?: { name?: string } | { name?: string }[] }).home_team
    const at = (m as { away_team?: { name?: string } | { name?: string }[] }).away_team
    const home_team = (Array.isArray(ht) ? ht[0] : ht)?.name ?? '—'
    const away_team = (Array.isArray(at) ? at[0] : at)?.name ?? '—'

    if (!byLeague[tournamentId]) {
      byLeague[tournamentId] = { league_id: tournamentId, league_name: leagueName, matches: [] }
    }
    byLeague[tournamentId].matches.push({
      ...m,
      home_team,
      away_team,
      bet: betsByMatch[m.id] ?? null,
    })
  }

  return NextResponse.json({ leagues: Object.values(byLeague) })
}
