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

  const result: Array<{
    id: number
    name: string
    country: string
    activeRooms: number
    totalBets: number
    previousRound: RoundInfo | null
    currentRound: RoundInfo | null
    nextRound: RoundInfo | null
  }> = []

  const { data: currentRoundsData } = await supabaseAdmin
    .from('current_rounds')
    .select('league_id, round_name, round_status')

  const currentRoundByLeague = new Map(
    (currentRoundsData ?? []).map((r: { league_id: number; round_name: string; round_status: string }) => [
      r.league_id,
      { round_name: r.round_name, round_status: r.round_status },
    ])
  )

  for (const league of leagues) {
    const leagueId = league.id as number

    const { data: games } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('league_id', leagueId)
      .eq('status', 'active')

    const gameIds = (games ?? []).map((g: { id: number }) => g.id)
    const activeRooms = gameIds.length

    let rounds: Array<{
      id: number
      name: string
      status: string
      betting_closes_at: string | null
      league_id: number
      match_count: number
    }> = []

    {
      const { data: roundsData } = await supabaseAdmin
        .from('rounds')
        .select('id, name, status, betting_closes_at, league_id')
        .eq('league_id', leagueId)
        .order('betting_closes_at', { ascending: true })

      for (const r of roundsData ?? []) {
        const { count: matchCount } = await supabaseAdmin
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('round_id', r.id)
        rounds.push({
          ...r,
          match_count: matchCount ?? 0,
        })
      }
    }

    const finished = rounds.filter((r) => r.status === 'finished')
    const upcoming = rounds.filter((r) => r.status === 'upcoming')

    const crInfo = currentRoundByLeague.get(leagueId)
    const currentRoundMatch = crInfo
      ? rounds.find((r) => r.name === crInfo.round_name)
      : null

    let currentRound: RoundInfo | null = null
    let totalBets = 0
    if (currentRoundMatch) {
      const { data: matchRows } = await supabaseAdmin.from('matches').select('id').eq('round_id', currentRoundMatch.id)
      const matchIds = (matchRows ?? []).map((m: { id: number }) => m.id)
      const { count: betsCount } = matchIds.length
        ? await supabaseAdmin.from('bets').select('*', { count: 'exact', head: true }).in('match_id', matchIds)
        : { count: 0 }
      totalBets = betsCount ?? 0
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

    result.push({
      id: league.id as number,
      name: league.name as string,
      country: (league.country as string) ?? '',
      activeRooms,
      totalBets,
      previousRound,
      currentRound,
      nextRound,
    })
  }

  return NextResponse.json({ leagues: result })
}
