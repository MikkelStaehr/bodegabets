/**
 * GET /api/users/me/deadlines
 * Returnerer bet-deadline status for alle brugerens aktive spilrum.
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
  if (gameIds.length === 0) return NextResponse.json({ deadlines: [] })

  const { data: gameLeagues } = await supabaseAdmin
    .from('game_leagues')
    .select('game_id, league_id')
    .in('game_id', gameIds)

  const leagueIds = [...new Set((gameLeagues ?? []).map((gl) => gl.league_id))]
  if (leagueIds.length === 0) return NextResponse.json({ deadlines: [] })

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, name')
    .in('id', gameIds)

  const gamesById = new Map((games ?? []).map((g) => [g.id, g]))
  const leagueIdByGame = new Map(
    (gameLeagues ?? []).map((gl) => [gl.game_id, gl.league_id])
  )

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, league_id, name, status, betting_closes_at')
    .in('league_id', leagueIds)
    .neq('status', 'finished')
    .order('betting_closes_at', { ascending: true })

  const roundsByLeague = new Map<number, { id: number; name: string; status: string; betting_closes_at: string | null }[]>()
  for (const r of rounds ?? []) {
    const lid = r.league_id as number
    if (!roundsByLeague.has(lid)) roundsByLeague.set(lid, [])
    roundsByLeague.get(lid)!.push({
      id: r.id as number,
      name: r.name as string,
      status: r.status as string,
      betting_closes_at: r.betting_closes_at as string | null,
    })
  }

  const { data: leagues } = await supabaseAdmin
    .from('leagues')
    .select('id, name')
    .in('id', leagueIds)

  const leagueNameById = new Map((leagues ?? []).map((l) => [l.id, l.name]))

  const now = new Date()
  const result: Array<{
    game_id: number
    game_name: string
    league_name: string
    round_name: string
    betting_closes_at: string | null
    deadline_status: 'open' | 'closed' | 'upcoming'
    bets_submitted: boolean
  }> = []

  for (const gameId of gameIds) {
    const game = gamesById.get(gameId)
    if (!game) continue

    const leagueId = leagueIdByGame.get(gameId)
    if (leagueId == null) continue

    const leagueRounds = roundsByLeague.get(leagueId) ?? []
    const activeRound = leagueRounds.find((r) => r.status === 'open')
      ?? leagueRounds.find((r) => r.status === 'upcoming')
      ?? leagueRounds[leagueRounds.length - 1]

    if (!activeRound) continue

    const closes = activeRound.betting_closes_at ? new Date(activeRound.betting_closes_at) : null
    const leagueName = leagueNameById.get(leagueId) ?? ''

    let deadlineStatus: 'open' | 'closed' | 'upcoming' = 'upcoming'
    if (closes) {
      if (closes < now) deadlineStatus = 'closed'
      else deadlineStatus = 'open'
    }

    const { count } = await supabaseAdmin
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('round_id', activeRound.id)

    result.push({
      game_id: game.id,
      game_name: game.name as string,
      league_name: leagueName as string,
      round_name: activeRound.name,
      betting_closes_at: activeRound.betting_closes_at,
      deadline_status: deadlineStatus,
      bets_submitted: (count ?? 0) > 0,
    })
  }

  return NextResponse.json({ deadlines: result })
}
