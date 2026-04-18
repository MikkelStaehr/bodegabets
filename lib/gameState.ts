/**
 * gameState.ts — samlet data-hentning for fodbold gamerooms.
 *
 * Dette er den ENE kilde der leverer ALT et gameroom har brug for til live-opdatering:
 *   - Match-liste (score, status, minut, bets, fordeling, ekstra bets)
 *   - Leaderboard (runde/blok point + sejre)
 *   - Game meta (sport, championship_mode, currentRound)
 *
 * Både de gamle /live-matches og /leaderboard endpoints bruger disse helpers
 * indtil de fjernes (fase 4). Den nye /state endpoint kalder getGameState().
 *
 * Pattern: hver helper tager (gameId, userId) — auth + membership-check
 * ligger i endpoint-lagret.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentChampionshipSeason } from '@/lib/gamePageHelpers'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MatchEntry = {
  id: number
  round_id: number
  round_name: string | null
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  home_score_ht: number | null
  away_score_ht: number | null
  status: string
  kickoff_at: string
  second_half_started_at: string | null
  home_team_logo: string | null
  away_team_logo: string | null
  tournamentLogo: string | null
  userPrediction: string | null
  bet_open: boolean
  distribution: MatchDistribution | null
  extraBetDist: Record<string, ExtraBetDist> | null
  userExtraPicks: Record<string, string> | null
  isRivalry: boolean
  rivalryName: string | null
}

export type MatchDistribution = {
  '1': number; 'X': number; '2': number
  total: number
  odds: { '1': number | null; 'X': number | null; '2': number | null }
}

export type ExtraBetDist = {
  count_1: number; count_2: number
  odds_1: number | null; odds_2: number | null
}

export type MatchSummary = {
  live: number
  halftime: number
  finished: number
  scheduled: number
  total: number
  roundName: string | null
}

export type LeaderboardEntry = {
  user_id: string
  username: string
  avatar_url: string | null
  round_wins: number
  round_points: number
  block_wins: number
  block_points: number
}

export type GameState = {
  game: {
    id: number
    name: string
    sport: string
    championship_mode: boolean
  }
  matches: MatchEntry[]
  summary: MatchSummary
  leaderboard: LeaderboardEntry[]
  updated_at: string
}

// ─── getGameMatches ─────────────────────────────────────────────────────────
// Returnerer kampe + summary for det aktive gameroom-view.

export async function getGameMatches(
  gameId: number,
  userId: string,
): Promise<{ matches: MatchEntry[]; summary: MatchSummary }> {
  const { data: gameInfo } = await supabaseAdmin
    .from('games')
    .select('championship_mode')
    .eq('id', gameId)
    .single()

  if (gameInfo?.championship_mode) {
    return getChampionshipMatches(gameId, userId)
  }
  return getRegularMatches(gameId, userId)
}

// ─── Regular (non-championship) ─────────────────────────────────────────────

async function getRegularMatches(
  gameId: number,
  userId: string,
): Promise<{ matches: MatchEntry[]; summary: MatchSummary }> {
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map((gs: { season_id: number }) => gs.season_id)
  if (seasonIds.length === 0) return { matches: [], summary: emptySummary() }

  const { data: seasonTournaments } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament:tournaments!tournament_id(logo_url)')
    .in('id', seasonIds)

  const tournamentLogoMap = new Map<number, string | null>()
  for (const st of seasonTournaments ?? []) {
    const t = st.tournament as unknown as { logo_url: string | null } | null
    tournamentLogoMap.set(st.id, t?.logo_url ?? null)
  }

  let { data: activeRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, season_id')
    .in('season_id', seasonIds)
    .or('status.eq.open,bet_open.eq.true')

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
    return { matches: [], summary: { ...emptySummary(), roundName: null } }
  }

  const roundSeasonMap = new Map<number, number>()
  for (const r of activeRounds ?? []) roundSeasonMap.set(r.id, r.season_id)

  const { data: roundMatches } = await supabaseAdmin
    .from('matches')
    .select(`id, round_id, round_name, kickoff_at:kickoff, status, result, second_half_started_at, bet_open,
      home_score, away_score, home_score_ht, away_score_ht, home_team_id, away_team_id,
      home_team_ref:teams!home_team_id(name, logo_url),
      away_team_ref:teams!away_team_id(name, logo_url)`)
    .in('round_id', activeRoundIds)
    .neq('status', 'cancelled')
    .order('kickoff', { ascending: true })

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

  const { data: userBets } = matchIds.length > 0
    ? await supabaseAdmin
        .from('bets')
        .select('match_id, prediction')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .eq('bet_type', 'match_result')
        .in('match_id', matchIds)
    : { data: [] }

  const betMap = new Map<number, string>()
  for (const b of userBets ?? []) betMap.set(b.match_id, b.prediction)

  const lockedMatchIds = (roundMatches ?? [])
    .filter((m) => (m as Record<string, unknown>).bet_open === false)
    .map((m) => m.id)

  const betDistribution: Record<number, MatchDistribution> = {}
  if (lockedMatchIds.length > 0) {
    const { data: allBets } = await supabaseAdmin
      .from('bets')
      .select('match_id, prediction, odds')
      .eq('game_id', gameId)
      .eq('bet_type', 'match_result')
      .in('match_id', lockedMatchIds)

    for (const bet of allBets ?? []) {
      if (!betDistribution[bet.match_id]) {
        betDistribution[bet.match_id] = {
          '1': 0, 'X': 0, '2': 0, total: 0,
          odds: { '1': null, 'X': null, '2': null },
        }
      }
      const d = betDistribution[bet.match_id]
      if (bet.prediction === '1' || bet.prediction === 'X' || bet.prediction === '2') {
        d[bet.prediction as '1' | 'X' | '2']++
        d.total++
        if (d.odds[bet.prediction as '1' | 'X' | '2'] === null && bet.odds != null) {
          d.odds[bet.prediction as '1' | 'X' | '2'] = bet.odds
        }
      }
    }
  }

  const extraBetDistribution: Record<number, Record<string, ExtraBetDist>> = {}
  if (lockedMatchIds.length > 0) {
    const { data: extraDistData } = await supabaseAdmin
      .from('bets')
      .select('match_id, bet_type, prediction, odds')
      .eq('game_id', gameId)
      .in('bet_type', ['goals_3plus', 'clean_sheet', 'win_margin'])
      .in('match_id', lockedMatchIds)

    const groups = new Map<string, ExtraBetDist>()
    for (const bet of extraDistData ?? []) {
      const key = `${bet.match_id}:${bet.bet_type}`
      if (!groups.has(key)) groups.set(key, { count_1: 0, count_2: 0, odds_1: null, odds_2: null })
      const g = groups.get(key)!
      if (bet.prediction === '1') { g.count_1++; if (g.odds_1 === null && bet.odds != null) g.odds_1 = bet.odds as number }
      if (bet.prediction === '2') { g.count_2++; if (g.odds_2 === null && bet.odds != null) g.odds_2 = bet.odds as number }
    }

    for (const [key, g] of groups) {
      const [matchIdStr, betType] = key.split(':')
      const matchId = parseInt(matchIdStr)
      if (!extraBetDistribution[matchId]) extraBetDistribution[matchId] = {}
      extraBetDistribution[matchId][betType] = g
    }
  }

  const { data: userExtraBets } = matchIds.length > 0
    ? await supabaseAdmin
        .from('bets')
        .select('match_id, bet_type, prediction')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .in('bet_type', ['goals_3plus', 'clean_sheet', 'win_margin'])
        .in('match_id', matchIds)
    : { data: [] }

  const extraBetMap = new Map<number, Record<string, string>>()
  for (const b of userExtraBets ?? []) {
    if (!extraBetMap.has(b.match_id)) extraBetMap.set(b.match_id, {})
    extraBetMap.get(b.match_id)![b.bet_type] = b.prediction
  }

  const matchList: MatchEntry[] = (roundMatches ?? []).map((m) => {
    const homeRef = m.home_team_ref as unknown as { name: string; logo_url: string | null } | null
    const awayRef = m.away_team_ref as unknown as { name: string; logo_url: string | null } | null
    const mm = m as Record<string, unknown>
    const hId = mm.home_team_id as number | null
    const aId = mm.away_team_id as number | null
    const rivalryName = hId && aId ? (rivalryInfo.get(`${hId}:${aId}`) ?? null) : null
    return {
      id: m.id as number,
      round_id: m.round_id as number,
      round_name: (m.round_name as string | null) ?? null,
      home_team: homeRef?.name ?? '',
      away_team: awayRef?.name ?? '',
      home_score: (m.home_score as number | null) ?? null,
      away_score: (m.away_score as number | null) ?? null,
      home_score_ht: (m.home_score_ht as number | null) ?? null,
      away_score_ht: (m.away_score_ht as number | null) ?? null,
      status: m.status as string,
      kickoff_at: m.kickoff_at as string,
      second_half_started_at: (mm.second_half_started_at as string | null) ?? null,
      home_team_logo: homeRef?.logo_url ?? null,
      away_team_logo: awayRef?.logo_url ?? null,
      tournamentLogo: tournamentLogoMap.get(roundSeasonMap.get(m.round_id as number) ?? 0) ?? null,
      userPrediction: betMap.get(m.id as number) ?? null,
      bet_open: (mm.bet_open as boolean | null) ?? true,
      distribution: betDistribution[m.id as number] ?? null,
      extraBetDist: extraBetDistribution[m.id as number] ?? null,
      userExtraPicks: extraBetMap.get(m.id as number) ?? null,
      isRivalry: rivalryName != null,
      rivalryName,
    }
  })

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

  return {
    matches: filteredList,
    summary: computeSummary(filteredList, roundName),
  }
}

// ─── Championship ───────────────────────────────────────────────────────────

async function getChampionshipMatches(
  gameId: number,
  userId: string,
): Promise<{ matches: MatchEntry[]; summary: MatchSummary }> {
  const { data: champRounds } = await supabaseAdmin
    .from('championship_rounds')
    .select(`
      id, name, status, betting_closes_at,
      championship_round_matches(
        match_id,
        matches(
          id, kickoff_at:kickoff, status, result, bet_open, second_half_started_at,
          home_score, away_score, home_score_ht, away_score_ht,
          home_team_id, away_team_id,
          home_team_ref:teams!home_team_id(name, logo_url),
          away_team_ref:teams!away_team_id(name, logo_url),
          season:seasons!season_id(
            tournament:tournaments!tournament_id(id, logo_url, name)
          )
        )
      )
    `)
    .eq('season', getCurrentChampionshipSeason())
    .neq('status', 'finished')
    .order('betting_closes_at', { ascending: true })

  const allChampMatches: MatchEntry[] = []

  for (const cr of champRounds ?? []) {
    for (const crm of cr.championship_round_matches as unknown[]) {
      const entry = crm as { match_id: number; matches: Record<string, unknown> | null }
      if (!entry.matches) continue
      const m = entry.matches
      const homeRef = m.home_team_ref as { name: string; logo_url: string | null } | null
      const awayRef = m.away_team_ref as { name: string; logo_url: string | null } | null
      allChampMatches.push({
        id: m.id as number,
        round_id: cr.id,
        round_name: cr.name,
        home_team: homeRef?.name ?? '',
        away_team: awayRef?.name ?? '',
        home_score: (m.home_score as number | null) ?? null,
        away_score: (m.away_score as number | null) ?? null,
        home_score_ht: (m.home_score_ht as number | null) ?? null,
        away_score_ht: (m.away_score_ht as number | null) ?? null,
        status: m.status as string,
        kickoff_at: (m.kickoff_at as string) ?? '',
        second_half_started_at: (m.second_half_started_at as string | null) ?? null,
        home_team_logo: homeRef?.logo_url ?? null,
        away_team_logo: awayRef?.logo_url ?? null,
        tournamentLogo: ((m.season as { tournament?: { logo_url?: string | null } } | null)?.tournament?.logo_url) ?? null,
        userPrediction: null,
        bet_open: (m.bet_open as boolean | null) ?? true,
        distribution: null,
        extraBetDist: null,
        userExtraPicks: null,
        isRivalry: true,
        rivalryName: null,
      })
    }
  }

  const champMatchIds = allChampMatches.map((m) => m.id)
  if (champMatchIds.length > 0) {
    const { data: champBets } = await supabaseAdmin
      .from('bets')
      .select('match_id, prediction')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .eq('bet_type', 'match_result')
      .in('match_id', champMatchIds)
    for (const b of champBets ?? []) {
      const match = allChampMatches.find((m) => m.id === b.match_id)
      if (match) match.userPrediction = b.prediction
    }

    const lockedChampIds = allChampMatches.filter((m) => !m.bet_open).map((m) => m.id)
    if (lockedChampIds.length > 0) {
      const { data: champDistBets } = await supabaseAdmin
        .from('bets')
        .select('match_id, prediction, odds')
        .eq('game_id', gameId)
        .eq('bet_type', 'match_result')
        .in('match_id', lockedChampIds)

      const champDist: Record<number, MatchDistribution> = {}
      for (const b of champDistBets ?? []) {
        if (!champDist[b.match_id]) {
          champDist[b.match_id] = {
            '1': 0, 'X': 0, '2': 0, total: 0,
            odds: { '1': null, 'X': null, '2': null },
          }
        }
        const pred = b.prediction as '1' | 'X' | '2'
        if (pred in champDist[b.match_id]) {
          champDist[b.match_id][pred]++
          champDist[b.match_id].total++
          if (champDist[b.match_id].odds[pred] === null && b.odds != null) {
            champDist[b.match_id].odds[pred] = b.odds as number
          }
        }
      }
      for (const match of allChampMatches) {
        if (champDist[match.id]) match.distribution = champDist[match.id]
      }
    }
  }

  const liveMatches = allChampMatches.filter((m) => m.status === 'live' || m.status === 'halftime')
  let targetRoundId: number | null = null
  if (liveMatches.length > 0) {
    targetRoundId = liveMatches[0].round_id
  } else {
    const earliest = allChampMatches
      .filter((m) => m.status !== 'finished')
      .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))[0]
    targetRoundId = earliest?.round_id ?? allChampMatches[0]?.round_id ?? null
  }

  const filteredList = [
    ...liveMatches,
    ...allChampMatches.filter((m) => m.round_id === targetRoundId && m.status !== 'live' && m.status !== 'halftime'),
  ].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))

  const roundName = (champRounds ?? []).find((r) => r.id === targetRoundId)?.name ?? null

  return {
    matches: filteredList,
    summary: computeSummary(filteredList, roundName),
  }
}

// ─── getGameLeaderboard ─────────────────────────────────────────────────────

export async function getGameLeaderboard(
  gameId: number,
): Promise<{ leaderboard: LeaderboardEntry[] }> {
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('sport, championship_mode')
    .eq('id', gameId)
    .single()

  if (!game) return { leaderboard: [] }

  const sport = game.sport ?? 'football'
  const isChampionship = game.championship_mode === true

  const { data: members } = await supabaseAdmin
    .from('game_members')
    .select('user_id, profiles!inner(username, avatar_url)')
    .eq('game_id', gameId)

  if (!members?.length) return { leaderboard: [] }

  if (sport === 'cycling') return buildCyclingLeaderboard(gameId, members)
  if (isChampionship) return buildChampionshipLeaderboard(gameId, members)
  return buildFootballLeaderboard(gameId, members)
}

async function buildFootballLeaderboard(
  gameId: number,
  members: { user_id: string; profiles: unknown }[],
): Promise<{ leaderboard: LeaderboardEntry[] }> {
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map((gs) => gs.season_id as number)
  if (seasonIds.length === 0) return { leaderboard: [] }

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, block_id, status')
    .in('season_id', seasonIds)

  const roundIds = (rounds ?? []).map((r) => r.id as number)
  if (roundIds.length === 0) return { leaderboard: [] }

  const { data: scores } = await supabaseAdmin
    .from('round_scores')
    .select('user_id, round_id, earnings_delta')
    .eq('game_id', gameId)
    .in('round_id', roundIds)

  const roundToBlock = new Map<number, number>()
  for (const r of rounds ?? []) {
    if (r.block_id) roundToBlock.set(r.id, r.block_id)
  }

  const finishedRoundIds = new Set(
    (rounds ?? []).filter((r) => r.status === 'finished').map((r) => r.id)
  )

  const userData = new Map<string, { roundPoints: Map<number, number>; blockPoints: Map<number, number> }>()
  for (const m of members) {
    userData.set(m.user_id, { roundPoints: new Map(), blockPoints: new Map() })
  }

  for (const s of scores ?? []) {
    const ud = userData.get(s.user_id)
    if (!ud) continue
    const pts = Number(s.earnings_delta) || 0
    ud.roundPoints.set(s.round_id, (ud.roundPoints.get(s.round_id) ?? 0) + pts)
    const blockId = roundToBlock.get(s.round_id)
    if (blockId) ud.blockPoints.set(blockId, (ud.blockPoints.get(blockId) ?? 0) + pts)
  }

  const roundWins = countWins(userData, 'roundPoints', finishedRoundIds)

  const allBlockIds = [...new Set((rounds ?? []).map((r) => r.block_id).filter((id): id is number => id != null))]
  let finishedBlockIds = new Set<number>()
  if (allBlockIds.length > 0) {
    const { data: blocks } = await supabaseAdmin
      .from('blocks')
      .select('id, status')
      .in('id', allBlockIds)
      .eq('status', 'finished')
    finishedBlockIds = new Set((blocks ?? []).map((b) => b.id as number))
  }
  const blockWins = countWins(userData, 'blockPoints', finishedBlockIds)

  return { leaderboard: buildEntries(members, userData, roundWins, blockWins) }
}

async function buildChampionshipLeaderboard(
  gameId: number,
  members: { user_id: string; profiles: unknown }[],
): Promise<{ leaderboard: LeaderboardEntry[] }> {
  const { data: scores } = await supabaseAdmin
    .from('round_scores')
    .select('user_id, round_id, earnings_delta')
    .eq('game_id', gameId)

  if (!scores?.length) {
    const empty = new Map<string, { roundPoints: Map<unknown, number>; blockPoints: Map<unknown, number> }>()
    return { leaderboard: buildEntries(members, empty, new Map(), new Map()) }
  }

  const roundIds = [...new Set(scores.map((s) => s.round_id as number))]
  const { data: champRounds } = await supabaseAdmin
    .from('championship_rounds')
    .select('id, status')
    .in('id', roundIds)

  const finishedRoundIds = new Set(
    (champRounds ?? []).filter((r) => r.status === 'finished').map((r) => r.id)
  )

  const userData = new Map<string, { roundPoints: Map<number, number>; blockPoints: Map<number, number> }>()
  for (const m of members) {
    userData.set(m.user_id, { roundPoints: new Map(), blockPoints: new Map() })
  }

  for (const s of scores) {
    const ud = userData.get(s.user_id as string)
    if (!ud) continue
    const pts = Number(s.earnings_delta) || 0
    ud.roundPoints.set(s.round_id, (ud.roundPoints.get(s.round_id) ?? 0) + pts)
    ud.blockPoints.set(0, (ud.blockPoints.get(0) ?? 0) + pts)
  }

  const roundWins = countWins(userData, 'roundPoints', finishedRoundIds)
  const blockWins = new Map<string, number>()

  return { leaderboard: buildEntries(members, userData, roundWins, blockWins) }
}

async function buildCyclingLeaderboard(
  gameId: number,
  members: { user_id: string; profiles: unknown }[],
): Promise<{ leaderboard: LeaderboardEntry[] }> {
  const { data: scores } = await supabaseAdmin
    .from('cycling_scores')
    .select('stage_id, race_id, total_points, cycling_lineups!inner(squad_id, cycling_squads!inner(user_id, game_id))')
    .eq('cycling_lineups.cycling_squads.game_id', gameId)

  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id, cycling_block_id')
    .eq('game_id', gameId)

  const raceToBlock = new Map<string, string>()
  for (const gr of gameRaces ?? []) {
    if (gr.cycling_block_id) raceToBlock.set(gr.race_id, gr.cycling_block_id)
  }

  const userData = new Map<string, { roundPoints: Map<string, number>; blockPoints: Map<string, number> }>()
  for (const m of members) {
    userData.set(m.user_id, { roundPoints: new Map(), blockPoints: new Map() })
  }

  for (const s of scores ?? []) {
    const lineup = s.cycling_lineups as unknown as { squad_id: string; cycling_squads: { user_id: string } }
    const userId = lineup?.cycling_squads?.user_id
    if (!userId) continue

    const ud = userData.get(userId)
    if (!ud) continue

    const pts = Number(s.total_points) || 0
    const stageId = s.stage_id as string
    ud.roundPoints.set(stageId, (ud.roundPoints.get(stageId) ?? 0) + pts)

    const blockId = raceToBlock.get(s.race_id as string)
    if (blockId) ud.blockPoints.set(blockId, (ud.blockPoints.get(blockId) ?? 0) + pts)
  }

  const stageIds = new Set<string>()
  for (const ud of userData.values()) for (const sid of ud.roundPoints.keys()) stageIds.add(sid)

  const allCyclingBlockIds = [...new Set([...userData.values()].flatMap((ud) => [...ud.blockPoints.keys()]))]
  let finishedCyclingBlockIds = new Set<string>()
  if (allCyclingBlockIds.length > 0) {
    const { data: cyclingBlocks } = await supabaseAdmin
      .from('cycling_blocks')
      .select('id, status')
      .in('id', allCyclingBlockIds)
    finishedCyclingBlockIds = new Set(
      (cyclingBlocks ?? [])
        .filter((b) => (b as { status?: string }).status === 'finished')
        .map((b) => b.id as string)
    )
  }

  const roundWins = countWins(userData, 'roundPoints', stageIds)
  const blockWins = countWins(userData, 'blockPoints', finishedCyclingBlockIds)

  return { leaderboard: buildEntries(members, userData, roundWins, blockWins) }
}

// ─── getGameState — kombineret state for /api/games/[id]/state ──────────────

export async function getGameState(
  gameId: number,
  userId: string,
): Promise<GameState | null> {
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name, sport, championship_mode')
    .eq('id', gameId)
    .single()

  if (!game) return null

  const [matchesResult, leaderboardResult] = await Promise.all([
    getGameMatches(gameId, userId),
    getGameLeaderboard(gameId),
  ])

  return {
    game: {
      id: game.id,
      name: game.name,
      sport: game.sport ?? 'football',
      championship_mode: game.championship_mode === true,
    },
    matches: matchesResult.matches,
    summary: matchesResult.summary,
    leaderboard: leaderboardResult.leaderboard,
    updated_at: new Date().toISOString(),
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptySummary(): MatchSummary {
  return { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0, roundName: null }
}

function computeSummary(list: MatchEntry[], roundName: string | null): MatchSummary {
  return {
    live: list.filter((m) => m.status === 'live').length,
    halftime: list.filter((m) => m.status === 'halftime').length,
    finished: list.filter((m) => m.status === 'finished').length,
    scheduled: list.filter((m) => m.status === 'scheduled').length,
    total: list.length,
    roundName,
  }
}

function countWins<K>(
  userData: Map<string, { roundPoints: Map<K, number>; blockPoints: Map<K, number> }>,
  field: 'roundPoints' | 'blockPoints',
  ids: Set<K>,
): Map<string, number> {
  const wins = new Map<string, number>()
  for (const id of ids) {
    let maxPts = -Infinity
    let winnerId: string | null = null
    for (const [uid, ud] of userData) {
      const pts = ud[field].get(id) ?? 0
      if (pts > maxPts) { maxPts = pts; winnerId = uid }
    }
    if (winnerId && maxPts > 0) {
      wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1)
    }
  }
  return wins
}

function buildEntries(
  members: { user_id: string; profiles: unknown }[],
  userData: Map<string, { roundPoints: Map<unknown, number>; blockPoints: Map<unknown, number> }>,
  roundWins: Map<string, number>,
  blockWins: Map<string, number>,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = members.map((m) => {
    const profile = m.profiles as { username: string; avatar_url: string | null }
    const ud = userData.get(m.user_id)

    let totalRoundPoints = 0
    if (ud) for (const pts of ud.roundPoints.values()) totalRoundPoints += pts

    let totalBlockPoints = 0
    if (ud) for (const pts of ud.blockPoints.values()) totalBlockPoints += pts

    return {
      user_id: m.user_id,
      username: profile?.username ?? 'Anonym',
      avatar_url: profile?.avatar_url ?? null,
      round_wins: roundWins.get(m.user_id) ?? 0,
      round_points: Math.round(totalRoundPoints * 10) / 10,
      block_wins: blockWins.get(m.user_id) ?? 0,
      block_points: Math.round(totalBlockPoints * 10) / 10,
    }
  })
  entries.sort((a, b) => b.block_points - a.block_points || b.round_points - a.round_points)
  return entries
}
