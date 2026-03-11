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

  // 1. All current rounds, all rounds, all active games — in parallel
  const [
    { data: currentRoundsData },
    { data: allRounds },
    { data: activeGames },
  ] = await Promise.all([
    supabaseAdmin
      .from('current_rounds')
      .select('league_id, round_name, round_status')
      .in('league_id', leagueIds),
    supabaseAdmin
      .from('rounds')
      .select('id, name, status, betting_closes_at, league_id')
      .in('league_id', leagueIds)
      .order('betting_closes_at', { ascending: true }),
    supabaseAdmin
      .from('games')
      .select('id, league_id')
      .in('league_id', leagueIds)
      .eq('status', 'active'),
  ])

  const currentRoundByLeague = new Map(
    (currentRoundsData ?? []).map((r: { league_id: number; round_name: string; round_status: string }) => [
      r.league_id,
      { round_name: r.round_name, round_status: r.round_status },
    ])
  )

  // Active rooms per league
  const activeRoomsByLeague = new Map<number, number>()
  for (const g of activeGames ?? []) {
    const lid = g.league_id as number
    activeRoomsByLeague.set(lid, (activeRoomsByLeague.get(lid) ?? 0) + 1)
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
  for (const league of leagues) {
    const crInfo = currentRoundByLeague.get(league.id as number)
    if (!crInfo) continue
    const round = (allRounds ?? []).find(
      (r) => r.league_id === league.id && r.name === crInfo.round_name
    )
    if (round) currentRoundIds.push(round.id as number)
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

    const rounds = (allRounds ?? [])
      .filter((r) => r.league_id === leagueId)
      .map((r) => ({
        ...r,
        id: r.id as number,
        name: r.name as string,
        status: r.status as string,
        betting_closes_at: r.betting_closes_at as string | null,
        league_id: r.league_id as number,
        match_count: matchCountByRound.get(r.id as number) ?? 0,
      }))

    const finished = rounds.filter((r) => r.status === 'finished')

    const crInfo = currentRoundByLeague.get(leagueId)
    const currentRoundMatch = crInfo
      ? rounds.find((r) => r.name === crInfo.round_name)
      : null

    const upcoming = rounds.filter((r) => r.status === 'upcoming' && r.id !== currentRoundMatch?.id)

    let currentRound: RoundInfo | null = null
    let totalBets = 0
    if (currentRoundMatch) {
      const matchIds = matchIdsByRound.get(currentRoundMatch.id) ?? []
      totalBets = matchIds.reduce((sum, mid) => sum + (betCountByMatch.get(mid) ?? 0), 0)
      currentRound = {
        id: currentRoundMatch.id,
        name: currentRoundMatch.name,
        kickoff_date: currentRoundMatch.betting_closes_at ?? '',
        status: crInfo?.round_status ?? currentRoundMatch.status,
        matchCount: currentRoundMatch.match_count,
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
