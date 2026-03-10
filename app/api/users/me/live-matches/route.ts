/**
 * GET /api/users/me/live-matches
 * Returnerer live kampe for brugerens aktive spil.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

function computeRoundStatus(round: { status: string; betting_closes_at: string | null }, now: Date): 'upcoming' | 'open' | 'active' | 'finished' {
  if (round.status === 'finished') return 'finished'
  if (!round.betting_closes_at) return 'upcoming'
  const closes = new Date(round.betting_closes_at)
  if (closes > now) return 'open'
  return 'active'
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { data: memberships } = await supabaseAdmin
    .from('game_members')
    .select('game_id')
    .eq('user_id', user.id)

  const gameIds = [...new Set((memberships ?? []).map((m) => m.game_id))]

  const now = new Date()
  const items: Array<{
    gameId: number
    gameName: string
    roundId: number
    roundName: string
    matches: unknown[]
    summary: { live: number; halftime: number; finished: number; total: number }
  }> = []

  for (const gameId of gameIds) {
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('id, name')
      .eq('id', gameId)
      .eq('status', 'active')
      .single()

    if (!game) continue

    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, status, betting_closes_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })

    const typedRounds = (rounds ?? []) as { id: number; name: string; status: string; betting_closes_at: string | null }[]
    const nowIso = now.toISOString()

    // Hent alle kampe for alle åbne/aktive runder i én query
    const openRoundIds = typedRounds
      .filter((r) => ['open', 'active'].includes(computeRoundStatus(r, now)))
      .map((r) => r.id)

    if (openRoundIds.length === 0) continue

    const since = new Date()
    since.setHours(since.getHours() - 24)

    const { data: allMatches } = await supabaseAdmin
      .from('matches')
      .select('id, round_id, home_team, away_team, home_score, away_score, home_ht_score, away_ht_score, status, kickoff_at')
      .in('round_id', openRoundIds)
      .in('status', ['live', 'halftime', 'finished'])
      .gte('kickoff_at', since.toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(100)

    // Find nyeste runde der har kampe med kickoff i fortiden
    const pastMatches = (allMatches ?? []).filter(
      (m) => m.kickoff_at && m.kickoff_at <= nowIso
    )

    const byRound = new Map<number, typeof pastMatches>()
    for (const m of pastMatches) {
      if (!byRound.has(m.round_id)) byRound.set(m.round_id, [])
      byRound.get(m.round_id)!.push(m)
    }

    // Prioriter nyeste runde (sidst i listen)
    let activeRound: (typeof typedRounds)[0] | null = null
    let matchList: typeof pastMatches = []
    for (let i = typedRounds.length - 1; i >= 0; i--) {
      const r = typedRounds[i]
      const list = byRound.get(r.id) ?? []
      if (list.length > 0) {
        activeRound = r
        matchList = list.sort((a, b) => (a.kickoff_at ?? '').localeCompare(b.kickoff_at ?? ''))
        break
      }
    }

    if (!activeRound || matchList.length === 0) continue

    const live = matchList.filter((m) => m.status === 'live').length
    const halftime = matchList.filter((m) => m.status === 'halftime').length
    const finished = matchList.filter((m) => m.status === 'finished').length

    items.push({
        gameId: game.id,
        gameName: game.name,
        roundId: activeRound.id,
        roundName: activeRound.name,
        matches: matchList,
        summary: { live, halftime, finished, total: matchList.length },
      })
  }

  return NextResponse.json({ items })
}
