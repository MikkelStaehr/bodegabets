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

  const { data: tournaments } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, country')
    .order('name')

  if (!tournaments?.length) {
    return NextResponse.json({ leagues: [] })
  }

  const tournamentIds = tournaments.map((t) => t.id as number)

  // Hent aktive sæsoner per turnering
  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament_id')
    .in('tournament_id', tournamentIds)
    .eq('is_active', true)

  const seasonIds = (seasons ?? []).map((s) => s.id as number)

  const [
    { data: allRounds },
    { data: gameSeasonRows },
  ] = await Promise.all([
    seasonIds.length
      ? supabaseAdmin
          .from('rounds')
          .select('id, name, status, betting_closes_at, season_id')
          .in('season_id', seasonIds)
          .order('betting_closes_at', { ascending: true })
      : { data: [] },
    supabaseAdmin
      .from('game_seasons')
      .select('game_id, season_id')
      .in('season_id', seasonIds),
  ])

  // Count active games per tournament (via season)
  const seasonByTournament = new Map<number, number[]>()
  for (const s of seasons ?? []) {
    const tid = s.tournament_id as number
    if (!seasonByTournament.has(tid)) seasonByTournament.set(tid, [])
    seasonByTournament.get(tid)!.push(s.id as number)
  }

  const gameIdsByTournament = new Map<number, number[]>()
  for (const gs of gameSeasonRows ?? []) {
    const sid = gs.season_id as number
    for (const [tid, sids] of seasonByTournament) {
      if (sids.includes(sid)) {
        if (!gameIdsByTournament.has(tid)) gameIdsByTournament.set(tid, [])
        gameIdsByTournament.get(tid)!.push(gs.game_id as number)
        break
      }
    }
  }

  const allGameIds = [...new Set((gameSeasonRows ?? []).map((gs) => gs.game_id as number))]
  const { data: activeGameRows } = allGameIds.length
    ? await supabaseAdmin
        .from('games')
        .select('id')
        .in('id', allGameIds)
        .eq('status', 'active')
    : { data: [] }

  const activeGameSet = new Set((activeGameRows ?? []).map((g) => g.id as number))

  const activeRoomsByTournament = new Map<number, number>()
  for (const [tid, gids] of gameIdsByTournament) {
    const count = gids.filter((gid) => activeGameSet.has(gid)).length
    if (count > 0) activeRoomsByTournament.set(tid, count)
  }

  const roundsBySeason = new Map<number, typeof allRounds>()
  for (const r of allRounds ?? []) {
    const sid = r.season_id as number
    if (!roundsBySeason.has(sid)) roundsBySeason.set(sid, [])
    roundsBySeason.get(sid)!.push(r)
  }

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

  const currentRoundIds: number[] = []
  const currentRoundBySeason = new Map<number, { id: number; name: string; status: string; betting_closes_at: string | null; match_count: number }>()
  for (const tid of tournamentIds) {
    const sids = seasonByTournament.get(tid) ?? []
    for (const sid of sids) {
      const seasonRounds = roundsBySeason.get(sid) ?? []
      const current = seasonRounds.find((r) => r.status === 'open')
        ?? seasonRounds.find((r) => r.status === 'upcoming')
      if (current) {
        currentRoundIds.push(current.id as number)
        currentRoundBySeason.set(sid, {
          id: current.id as number,
          name: current.name as string,
          status: current.status as string,
          betting_closes_at: current.betting_closes_at as string | null,
          match_count: matchCountByRound.get(current.id as number) ?? 0,
        })
      }
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

  const result = tournaments.map((tournament) => {
    const tid = tournament.id as number
    const sids = seasonByTournament.get(tid) ?? []
    const activeRooms = activeRoomsByTournament.get(tid) ?? 0

    let totalBets = 0
    let currentRound: RoundInfo | null = null
    let previousRound: RoundInfo | null = null
    let nextRound: RoundInfo | null = null

    for (const sid of sids) {
      const crInfo = currentRoundBySeason.get(sid)
      if (crInfo) {
        const matchIds = matchIdsByRound.get(crInfo.id) ?? []
        totalBets += matchIds.reduce((sum, mid) => sum + (betCountByMatch.get(mid) ?? 0), 0)
        currentRound = {
          id: crInfo.id,
          name: crInfo.name,
          kickoff_date: crInfo.betting_closes_at ?? '',
          status: crInfo.status,
          matchCount: crInfo.match_count,
          betsCount: matchIds.reduce((sum, mid) => sum + (betCountByMatch.get(mid) ?? 0), 0),
        }
      }

      const seasonRounds = roundsBySeason.get(sid) ?? []
      const finished = seasonRounds.filter((r) => r.status === 'finished')
      const upcoming = seasonRounds.filter((r) => r.status === 'upcoming' && r.id !== currentRound?.id)

      if (finished.length && !previousRound) {
        const last = finished[finished.length - 1]
        previousRound = {
          id: last.id as number,
          name: last.name as string,
          kickoff_date: (last.betting_closes_at as string) ?? '',
          status: last.status as string,
          matchCount: matchCountByRound.get(last.id as number) ?? 0,
        }
      }
      if (upcoming.length && !nextRound) {
        const first = upcoming[0]
        nextRound = {
          id: first.id as number,
          name: first.name as string,
          kickoff_date: (first.betting_closes_at as string) ?? '',
          status: first.status as string,
          matchCount: matchCountByRound.get(first.id as number) ?? 0,
        }
      }
    }

    return {
      id: tid,
      name: tournament.name as string,
      country: (tournament.country as string) ?? '',
      activeRooms,
      totalBets,
      previousRound,
      currentRound,
      nextRound,
    }
  })

  return NextResponse.json({ leagues: result })
}
