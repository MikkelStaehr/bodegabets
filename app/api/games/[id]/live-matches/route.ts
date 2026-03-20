import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type Props = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json({ error: 'Ugyldigt game_id' }, { status: 400 })
  }

  // Tjek membership
  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  // Hent alle season_ids for dette spil
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map((gs: { season_id: number }) => gs.season_id)
  if (seasonIds.length === 0) {
    return NextResponse.json({ matches: [], summary: { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 } })
  }

  // Hent tournament logos via season → tournament
  const { data: seasonTournaments } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament:tournaments!tournament_id(logo_url)')
    .in('id', seasonIds)

  const tournamentLogoMap = new Map<number, string | null>()
  for (const st of seasonTournaments ?? []) {
    const tournament = st.tournament as unknown as { logo_url: string | null } | null
    tournamentLogoMap.set(st.id, tournament?.logo_url ?? null)
  }

  // Hent kun runder med status = 'open' (ikke upcoming/bet_open)
  const { data: openRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, season_id')
    .in('season_id', seasonIds)
    .eq('status', 'open')

  const openRoundIds = (openRounds ?? []).map((r: { id: number }) => r.id)
  if (openRoundIds.length === 0) {
    return NextResponse.json({ matches: [], summary: { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 } })
  }

  // Map round_id → season_id for tournament logo lookup
  const roundSeasonMap = new Map<number, number>()
  for (const r of openRounds ?? []) {
    roundSeasonMap.set(r.id, r.season_id)
  }

  // Hent ALLE kampe for åbne runder via round_id (uanset kamp status/dato, undtagen cancelled)
  const { data: roundMatches } = await supabaseAdmin
    .from('matches')
    .select(`id, round_id, round_name, kickoff_at:kickoff, status, result, second_half_started_at, current_minute,
      home_score, away_score, home_score_ht, away_score_ht,
      home_team_ref:teams!home_team_id(name, logo_url),
      away_team_ref:teams!away_team_id(name, logo_url)`)
    .in('round_id', openRoundIds)
    .neq('status', 'cancelled')
    .order('kickoff', { ascending: true })

  // Hent brugerens match_result bets for disse kampe
  const matchIds = (roundMatches ?? []).map((m) => m.id)
  const { data: userBets } = matchIds.length > 0
    ? await supabaseAdmin
        .from('bets')
        .select('match_id, prediction')
        .eq('user_id', user.id)
        .eq('game_id', gameId)
        .eq('bet_type', 'match_result')
        .in('match_id', matchIds)
    : { data: [] }

  const betMap = new Map<number, string>()
  for (const b of userBets ?? []) {
    betMap.set(b.match_id, b.prediction)
  }

  const matchList = (roundMatches ?? []).map((m) => {
    const homeRef = m.home_team_ref as unknown as { name: string; logo_url: string | null } | null
    const awayRef = m.away_team_ref as unknown as { name: string; logo_url: string | null } | null
    return {
      id: m.id,
      round_id: m.round_id,
      round_name: m.round_name,
      home_team: homeRef?.name ?? '',
      away_team: awayRef?.name ?? '',
      home_score: m.home_score,
      away_score: m.away_score,
      home_score_ht: m.home_score_ht,
      away_score_ht: m.away_score_ht,
      status: m.status,
      kickoff_at: m.kickoff_at,
      second_half_started_at: (m as Record<string, unknown>).second_half_started_at ?? null,
      current_minute: (m as Record<string, unknown>).current_minute ?? null,
      home_team_logo: homeRef?.logo_url ?? null,
      away_team_logo: awayRef?.logo_url ?? null,
      tournamentLogo: tournamentLogoMap.get(roundSeasonMap.get(m.round_id) ?? 0) ?? null,
      userPrediction: betMap.get(m.id) ?? null,
    }
  })

  const live = matchList.filter((m) => m.status === 'live').length
  const halftime = matchList.filter((m) => m.status === 'halftime').length
  const finished = matchList.filter((m) => m.status === 'finished').length
  const scheduled = matchList.filter((m) => m.status === 'scheduled').length
  const total = matchList.length

  return NextResponse.json({
    matches: matchList,
    summary: { live, halftime, finished, scheduled, total },
  })
}
