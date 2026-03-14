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

  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('game_id, season_id')
    .in('game_id', gameIds)

  const seasonIds = [...new Set((gameSeasons ?? []).map((gs) => gs.season_id))]
  if (seasonIds.length === 0) return NextResponse.json({ deadlines: [] })

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, name')
    .in('id', gameIds)

  const gamesById = new Map((games ?? []).map((g) => [g.id, g]))
  const seasonIdByGame = new Map(
    (gameSeasons ?? []).map((gs) => [gs.game_id, gs.season_id])
  )

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id, name, status, betting_closes_at')
    .in('season_id', seasonIds)
    .neq('status', 'finished')
    .order('betting_closes_at', { ascending: true })

  const roundsBySeason = new Map<number, { id: number; name: string; status: string; betting_closes_at: string | null }[]>()
  for (const r of rounds ?? []) {
    const sid = r.season_id as number
    if (!roundsBySeason.has(sid)) roundsBySeason.set(sid, [])
    roundsBySeason.get(sid)!.push({
      id: r.id as number,
      name: r.name as string,
      status: r.status as string,
      betting_closes_at: r.betting_closes_at as string | null,
    })
  }

  const { data: seasonRows } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament_id, tournaments(name)')
    .in('id', seasonIds)

  const leagueNameBySeason = new Map<number, string>()
  for (const s of seasonRows ?? []) {
    const t = (s as { tournaments?: { name?: string } | { name?: string }[] }).tournaments
    const name = (Array.isArray(t) ? t[0] : t)?.name ?? 'Ukendt'
    leagueNameBySeason.set(s.id as number, name)
  }

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

    const seasonId = seasonIdByGame.get(gameId)
    if (seasonId == null) continue

    const seasonRounds = roundsBySeason.get(seasonId) ?? []
    const activeRound = seasonRounds.find((r) => r.status === 'open')
      ?? seasonRounds.find((r) => r.status === 'upcoming')
      ?? seasonRounds[seasonRounds.length - 1]

    if (!activeRound) continue

    const closes = activeRound.betting_closes_at ? new Date(activeRound.betting_closes_at) : null
    const leagueName = leagueNameBySeason.get(seasonId) ?? ''

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
