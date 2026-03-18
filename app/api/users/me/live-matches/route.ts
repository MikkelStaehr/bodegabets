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
    leagueName: string | null
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

    // Hent season_id via game_seasons junction table
    const { data: gameSeason } = await supabaseAdmin
      .from('game_seasons')
      .select('season_id')
      .eq('game_id', gameId)
      .limit(1)
      .single()

    const seasonId = gameSeason?.season_id
    if (!seasonId) continue

    // Hent league/tournament name via season
    const { data: season } = await supabaseAdmin
      .from('seasons')
      .select('tournaments:tournament_id(name)')
      .eq('id', seasonId)
      .single()
    const leagueName = (season?.tournaments as unknown as { name: string } | null)?.name ?? null

    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, status, betting_closes_at')
      .eq('season_id', seasonId)
      .order('created_at', { ascending: true })

    const typedRounds = (rounds ?? []) as { id: number; name: string; status: string; betting_closes_at: string | null }[]
    const nowIso = now.toISOString()

    // Find åbne/aktive runder
    const openRounds = typedRounds
      .filter((r) => ['open', 'active'].includes(computeRoundStatus(r, now)))

    if (openRounds.length === 0) continue

    const openRoundNames = openRounds.map((r) => r.name)

    const since = new Date()
    since.setHours(since.getHours() - 24)

    // Hent kampe via season_id + round_name (matches har ingen round_id)
    const { data: allMatches } = await supabaseAdmin
      .from('matches')
      .select(`id, round_name, home_score, away_score, home_score_ht, away_score_ht, status, kickoff, second_half_started_at,
        home_team_ref:teams!home_team_id(name, logo_url),
        away_team_ref:teams!away_team_id(name, logo_url)`)
      .eq('season_id', seasonId)
      .in('round_name', openRoundNames)
      .in('status', ['live', 'halftime', 'finished'])
      .gte('kickoff', since.toISOString())
      .order('kickoff', { ascending: true })
      .limit(100)

    // Find nyeste runde der har kampe med kickoff i fortiden
    const pastMatches = (allMatches ?? [])
      .filter((m) => m.kickoff && m.kickoff <= nowIso)
      .map((m) => {
        const homeRef = m.home_team_ref as unknown as { name: string; logo_url: string | null } | null
        const awayRef = m.away_team_ref as unknown as { name: string; logo_url: string | null } | null
        return {
          id: m.id,
          round_name: m.round_name,
          home_team: homeRef?.name ?? '',
          away_team: awayRef?.name ?? '',
          home_score: m.home_score,
          away_score: m.away_score,
          home_score_ht: m.home_score_ht,
          away_score_ht: m.away_score_ht,
          status: m.status,
          kickoff_at: m.kickoff,
          second_half_started_at: (m as Record<string, unknown>).second_half_started_at ?? null,
          home_team_logo: homeRef?.logo_url ?? null,
          away_team_logo: awayRef?.logo_url ?? null,
        }
      })

    // Grupper kampe efter round_name og map til round id
    const byRoundName = new Map<string, typeof pastMatches>()
    for (const m of pastMatches) {
      if (!m.round_name) continue
      if (!byRoundName.has(m.round_name)) byRoundName.set(m.round_name, [])
      byRoundName.get(m.round_name)!.push(m)
    }

    // Prioriter nyeste runde (sidst i listen)
    let activeRound: (typeof typedRounds)[0] | null = null
    let matchList: typeof pastMatches = []
    for (let i = typedRounds.length - 1; i >= 0; i--) {
      const r = typedRounds[i]
      const list = byRoundName.get(r.name) ?? []
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
        leagueName,
        roundId: activeRound.id,
        roundName: activeRound.name,
        matches: matchList,
        summary: { live, halftime, finished, total: matchList.length },
      })
  }

  return NextResponse.json({ items })
}
