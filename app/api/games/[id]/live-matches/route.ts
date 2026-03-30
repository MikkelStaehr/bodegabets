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

  // Hent aktive runder: status='open' eller bet_open=true
  let { data: activeRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, season_id')
    .in('season_id', seasonIds)
    .or('status.eq.open,bet_open.eq.true')

  // Fallback: næste upcoming runde
  if (!activeRounds?.length) {
    const { data: upcomingRounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, season_id')
      .in('season_id', seasonIds)
      .eq('status', 'upcoming')
      .order('betting_closes_at', { ascending: true, nullsFirst: false })
    activeRounds = upcomingRounds ?? []
  }

  const activeRoundIds = (activeRounds ?? []).map((r: { id: number }) => r.id)
  if (activeRoundIds.length === 0) {
    return NextResponse.json({ matches: [], summary: { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0, roundName: null } })
  }

  // Map round_id → season_id for tournament logo lookup
  const roundSeasonMap = new Map<number, number>()
  for (const r of activeRounds ?? []) {
    roundSeasonMap.set(r.id, r.season_id)
  }

  // Hent ALLE kampe for åbne runder via round_id (uanset kamp status/dato, undtagen cancelled)
  const { data: roundMatches } = await supabaseAdmin
    .from('matches')
    .select(`id, round_id, round_name, kickoff_at:kickoff, status, result, second_half_started_at, bet_open,
      home_score, away_score, home_score_ht, away_score_ht, home_team_id, away_team_id,
      home_team_ref:teams!home_team_id(name, logo_url),
      away_team_ref:teams!away_team_id(name, logo_url)`)
    .in('round_id', activeRoundIds)
    .neq('status', 'cancelled')
    .order('kickoff', { ascending: true })

  // Rivalry lookup
  const matchIds = (roundMatches ?? []).map((m) => m.id)
  const allMatchTeamIds = [...new Set(
    (roundMatches ?? [])
      .flatMap((m) => {
        const mm = m as Record<string, unknown>
        return [mm.home_team_id as number | null, mm.away_team_id as number | null]
      })
      .filter((id): id is number => id != null)
  )]
  const rivalryInfo = new Map<string, string>()
  if (allMatchTeamIds.length > 0) {
    const { data: rivalries } = await supabaseAdmin
      .from('rivalries')
      .select('team_id, rival_team_id, rivalry_name')
      .in('team_id', allMatchTeamIds)
      .in('rival_team_id', allMatchTeamIds)
    for (const r of rivalries ?? []) {
      rivalryInfo.set(`${r.team_id}:${r.rival_team_id}`, r.rivalry_name)
      rivalryInfo.set(`${r.rival_team_id}:${r.team_id}`, r.rivalry_name)
    }
  }

  // Hent brugerens match_result bets for disse kampe
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

  // Hent bet-fordeling for låste kampe
  const lockedMatchIds = (roundMatches ?? []).filter(m => (m as Record<string, unknown>).bet_open === false).map(m => m.id)

  type DistEntry = { '1': number; 'X': number; '2': number; total: number; odds: { '1': number | null; 'X': number | null; '2': number | null } }
  let betDistribution: Record<number, DistEntry> = {}

  if (lockedMatchIds.length > 0) {
    const { data: allBets } = await supabaseAdmin
      .from('bets')
      .select('match_id, prediction, odds')
      .eq('game_id', gameId)
      .eq('bet_type', 'match_result')
      .in('match_id', lockedMatchIds)

    for (const bet of allBets ?? []) {
      if (!betDistribution[bet.match_id]) {
        betDistribution[bet.match_id] = { '1': 0, 'X': 0, '2': 0, total: 0, odds: { '1': null, 'X': null, '2': null } }
      }
      if (bet.prediction === '1' || bet.prediction === 'X' || bet.prediction === '2') {
        betDistribution[bet.match_id][bet.prediction as '1' | 'X' | '2']++
        betDistribution[bet.match_id].total++
        if (betDistribution[bet.match_id].odds[bet.prediction as '1' | 'X' | '2'] === null && bet.odds != null) {
          betDistribution[bet.match_id].odds[bet.prediction as '1' | 'X' | '2'] = bet.odds
        }
      }
    }
  }

  const matchList = (roundMatches ?? []).map((m) => {
    const homeRef = m.home_team_ref as unknown as { name: string; logo_url: string | null } | null
    const awayRef = m.away_team_ref as unknown as { name: string; logo_url: string | null } | null
    const mm = m as Record<string, unknown>
    const hId = mm.home_team_id as number | null
    const aId = mm.away_team_id as number | null
    const rivalryName = (hId && aId) ? (rivalryInfo.get(`${hId}:${aId}`) ?? null) : null
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
      second_half_started_at: mm.second_half_started_at ?? null,
      home_team_logo: homeRef?.logo_url ?? null,
      away_team_logo: awayRef?.logo_url ?? null,
      tournamentLogo: tournamentLogoMap.get(roundSeasonMap.get(m.round_id) ?? 0) ?? null,
      userPrediction: betMap.get(m.id) ?? null,
      bet_open: mm.bet_open ?? true,
      distribution: betDistribution[m.id] ?? null,
      isRivalry: rivalryName != null,
      rivalryName,
    }
  })

  // Find target runde: åben runde med tidligste kommende kickoff
  const alwaysShow = matchList.filter((m) => m.status === 'live' || m.status === 'halftime')

  let targetRoundId: number | null = null
  if (alwaysShow.length > 0) {
    targetRoundId = alwaysShow[0].round_id
  } else {
    const earliest = matchList
      .filter((m) => m.status !== 'finished')
      .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))[0]
    targetRoundId = earliest?.round_id ?? matchList[0]?.round_id ?? null
  }

  const filteredList = [
    ...alwaysShow,
    ...matchList.filter((m) => m.round_id === targetRoundId && m.status !== 'live' && m.status !== 'halftime'),
  ].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))

  const roundName = (activeRounds ?? []).find((r) => r.id === targetRoundId)?.name ?? null

  const live = filteredList.filter((m) => m.status === 'live').length
  const halftime = filteredList.filter((m) => m.status === 'halftime').length
  const finished = filteredList.filter((m) => m.status === 'finished').length
  const scheduled = filteredList.filter((m) => m.status === 'scheduled').length
  const total = filteredList.length

  return NextResponse.json({
    matches: filteredList,
    summary: { live, halftime, finished, scheduled, total, roundName },
  })
}
