import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

type RoundInfo = {
  id: number
  name: string
  kickoff_date: string
  status: string
  matchCount?: number
  betsCount?: number
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data: leagues } = await supabaseAdmin
    .from('leagues')
    .select('id, name, country')
    .order('name')

  if (!leagues?.length) {
    return NextResponse.json({ leagues: [] })
  }

  const leagueIds = leagues.map((l) => l.id as number)

  // 1. All rounds, all active games via game_leagues — in parallel
  const [
    { data: allRounds },
    { data: gameLeagueRows },
  ] = await Promise.all([
    supabaseAdmin
      .from('rounds')
      .select('id, name, status, betting_closes_at, league_id')
      .in('league_id', leagueIds)
      .order('betting_closes_at', { ascending: true }),
    supabaseAdmin
      .from('game_leagues')
      .select('game_id, league_id')
      .in('league_id', leagueIds),
  ])

  // Count active games per league
  const gameIdsByLeague = new Map<number, number[]>()
  for (const gl of gameLeagueRows ?? []) {
    const lid = gl.league_id as number
    if (!gameIdsByLeague.has(lid)) gameIdsByLeague.set(lid, [])
    gameIdsByLeague.get(lid)!.push(gl.game_id as number)
  }

  // Check which games are active
  const allGameIds = [...new Set((gameLeagueRows ?? []).map((gl) => gl.game_id as number))]
  const { data: activeGameRows } = allGameIds.length
    ? await supabaseAdmin
        .from('games')
        .select('id')
        .in('id', allGameIds)
        .eq('status', 'active')
    : { data: [] }

  const activeGameSet = new Set((activeGameRows ?? []).map((g) => g.id as number))

  const activeRoomsByLeague = new Map<number, number>()
  for (const [lid, gids] of gameIdsByLeague) {
    const count = gids.filter((gid) => activeGameSet.has(gid)).length
    if (count > 0) activeRoomsByLeague.set(lid, count)
  }

  // Determine "current round" per league: first open/upcoming round, or latest finished
  const roundsByLeague = new Map<number, typeof allRounds>()
  for (const r of allRounds ?? []) {
    const lid = r.league_id as number
    if (!roundsByLeague.has(lid)) roundsByLeague.set(lid, [])
    roundsByLeague.get(lid)!.push(r)
  }

  // 2. All match counts per round in one query
  const allRoundIds = (allRounds ?? []).map((r) => r.id as number)
  const { data: allMatches } = allRoundIds.length
    ? await supabaseAdmin
        .from('matches')
        .select('id, round_id')
        .in('round_id', allRoundIds)
    : { data: [] }

  const matchCountByRound = new Map<number, number>()
  const matchIdsByRound = new Map<number, number[]>()
  for (const m of allMatches ?? []) {
    const rid = m.round_id as number
    matchCountByRound.set(rid, (matchCountByRound.get(rid) ?? 0) + 1)
    if (!matchIdsByRound.has(rid)) matchIdsByRound.set(rid, [])
    matchIdsByRound.get(rid)!.push(m.id as number)
  }

  // 3. Bets counts for current rounds only (one query)
  const currentRoundIds: number[] = []
  const currentRoundByLeague = new Map<number, { id: number; name: string; status: string; betting_closes_at: string | null; match_count: number }>()
  for (const league of leagues) {
    const lid = league.id as number
    const leagueRounds = roundsByLeague.get(lid) ?? []
    // Current = first open round, or first upcoming
    const current = leagueRounds.find((r) => r.status === 'open')
      ?? leagueRounds.find((r) => r.status === 'upcoming')
    if (current) {
      currentRoundIds.push(current.id as number)
      currentRoundByLeague.set(lid, {
        id: current.id as number,
        name: current.name as string,
        status: current.status as string,
        betting_closes_at: current.betting_closes_at as string | null,
        match_count: matchCountByRound.get(current.id as number) ?? 0,
      })
    }
  }

  const currentMatchIds: number[] = []
  for (const rid of currentRoundIds) {
    const ids = matchIdsByRound.get(rid)
    if (ids) currentMatchIds.push(...ids)
  }

  const betCountByMatch = new Map<number, number>()
  if (currentMatchIds.length) {
    const { data: allBets } = await supabaseAdmin
      .from('bets')
      .select('match_id')
      .in('match_id', currentMatchIds)

    for (const b of allBets ?? []) {
      const mid = b.match_id as number
      betCountByMatch.set(mid, (betCountByMatch.get(mid) ?? 0) + 1)
    }
  }

  // Assemble response
  const result = leagues.map((league) => {
    const leagueId = league.id as number
    const activeRooms = activeRoomsByLeague.get(leagueId) ?? 0

    const rounds = (roundsByLeague.get(leagueId) ?? [])
      .map((r) => ({
        id: r.id as number,
        name: r.name as string,
        status: r.status as string,
        betting_closes_at: r.betting_closes_at as string | null,
        league_id: r.league_id as number,
        match_count: matchCountByRound.get(r.id as number) ?? 0,
      }))

    const finished = rounds.filter((r) => r.status === 'finished')

    const crInfo = currentRoundByLeague.get(leagueId)

    const upcoming = rounds.filter((r) => r.status === 'upcoming' && r.id !== crInfo?.id)

    let currentRound: RoundInfo | null = null
    let totalBets = 0
    if (crInfo) {
      const matchIds = matchIdsByRound.get(crInfo.id) ?? []
      totalBets = matchIds.reduce((sum, mid) => sum + (betCountByMatch.get(mid) ?? 0), 0)
      currentRound = {
        id: crInfo.id,
        name: crInfo.name,
        kickoff_date: crInfo.betting_closes_at ?? '',
        status: crInfo.status,
        matchCount: crInfo.match_count,
        betsCount: totalBets,
      }
    }

    const previousRound: RoundInfo | null = finished.length
      ? {
          id: finished[finished.length - 1].id,
          name: finished[finished.length - 1].name,
          kickoff_date: finished[finished.length - 1].betting_closes_at ?? '',
          status: finished[finished.length - 1].status,
          matchCount: finished[finished.length - 1].match_count,
        }
      : null

    const nextRound: RoundInfo | null = upcoming.length
      ? {
          id: upcoming[0].id,
          name: upcoming[0].name,
          kickoff_date: upcoming[0].betting_closes_at ?? '',
          status: upcoming[0].status,
          matchCount: upcoming[0].match_count,
        }
      : null

    return {
      id: leagueId,
      name: league.name as string,
      country: (league.country as string) ?? '',
      activeRooms,
      totalBets,
      previousRound,
      currentRound,
      nextRound,
    }
  })

  return NextResponse.json({ leagues: result })
}
