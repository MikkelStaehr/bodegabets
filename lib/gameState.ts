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
import { findActiveSubBlock, getBlockStageRange } from '@/lib/cyclingBlocks'

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
  /** Sammenlagt point (profit) på tværs af ALLE runder/blokke i spillet. */
  total_points: number
  /** Netto-profit: samlet vundet − samlet satset (kun afgjorte bets). */
  net_profit: number
  /** 🧸 Fidusbamser: antal runder hvor spilleren scorede flest point (Man of the Match). */
  mvp_count: number
}

export type BlockStandingRow = {
  user_id: string
  username: string
  total: number
  rank: number
}

export type ActiveBlockStandings = {
  block_id: number
  block_name: string
  block_number: number
  rounds_remaining: number
  rows: BlockStandingRow[]
} | null

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
  activeBlockStandings: ActiveBlockStandings
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

  // Hent ALLE blocks så vi kan vælge "nuværende" (lavest block_order, ikke-finished)
  const allBlockIds = [...new Set((rounds ?? []).map((r) => r.block_id).filter((id): id is number => id != null))]
  let allBlocks: { id: number; block_number: number; status: string }[] = []
  if (allBlockIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('blocks')
      .select('id, block_number, status')
      .in('id', allBlockIds)
      .order('block_number', { ascending: true })
    allBlocks = (data ?? []) as typeof allBlocks
  }

  const finishedBlockIds = new Set(
    allBlocks.filter((b) => b.status === 'finished').map((b) => b.id),
  )

  // "Nuværende" blok = laveste block_number der ikke er finished.
  // Hvis alle er finished → seneste (højeste block_number).
  const currentBlock =
    allBlocks.find((b) => b.status !== 'finished') ??
    [...allBlocks].reverse()[0] ??
    null
  const currentBlockId = currentBlock?.id ?? null

  // Filtrér runder til kun den nuværende blok
  const currentBlockRoundIds = new Set(
    (rounds ?? []).filter((r) => r.block_id === currentBlockId).map((r) => r.id as number),
  )

  const { data: scores } = await supabaseAdmin
    .from('round_scores')
    .select('user_id, round_id, earnings_delta')
    .eq('game_id', gameId)
    .in('round_id', roundIds)

  const finishedRoundIds = new Set(
    (rounds ?? []).filter((r) => r.status === 'finished').map((r) => r.id),
  )
  const finishedRoundsInCurrent = new Set(
    [...finishedRoundIds].filter((rid) => currentBlockRoundIds.has(rid as number)),
  )

  // userData.roundPoints/blockPoints rummer KUN nuværende blok-data
  const userData = new Map<string, { roundPoints: Map<number, number>; blockPoints: Map<number, number> }>()
  for (const m of members) {
    userData.set(m.user_id, { roundPoints: new Map(), blockPoints: new Map() })
  }
  // Spil UDEN blokke (fx VM): runderne har block_id=null → currentBlockId=null.
  // Da samles alle runder under én "blok" (sentinel-nøgle 0), så block_points
  // = sæsonens samlede point. Uden dette var blok-point altid 0 (det gamle
  // `if (currentBlockId)` sprang akkumuleringen over) → leaderboardet viste "—".
  const blockKey = currentBlockId ?? 0
  for (const s of scores ?? []) {
    if (!currentBlockRoundIds.has(s.round_id as number)) continue
    const ud = userData.get(s.user_id)
    if (!ud) continue
    const pts = Number(s.earnings_delta) || 0
    ud.roundPoints.set(s.round_id, (ud.roundPoints.get(s.round_id) ?? 0) + pts)
    ud.blockPoints.set(blockKey, (ud.blockPoints.get(blockKey) ?? 0) + pts)
  }

  // R. SEJR = wins i nuværende bloks finished rounds.
  // B. SEJR = historiske vundne blokke (alle finished blocks samlet — kræver at vi
  // ser scores for tidligere blokke separat).
  const roundWins = countWins(userData, 'roundPoints', finishedRoundsInCurrent)
  const blockWins = await countHistoricalBlockWins(
    gameId,
    members,
    rounds ?? [],
    finishedBlockIds,
  )

  // Akkumuleret point = profit på tværs af ALLE runder (ikke kun nuværende blok).
  const totalByUser = new Map<string, number>()
  for (const s of scores ?? []) {
    totalByUser.set(s.user_id, (totalByUser.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0))
  }

  // Netto-profit = samlet vundet − samlet satset (kun afgjorte bets).
  const { data: betRows } = await supabaseAdmin
    .from('bets')
    .select('user_id, stake, points_earned, result')
    .eq('game_id', gameId)
    .in('round_id', roundIds)
  const netByUser = new Map<string, number>()
  for (const b of betRows ?? []) {
    if (b.result !== 'win' && b.result !== 'loss') continue
    const delta = (Number(b.points_earned) || 0) - (Number(b.stake) || 0)
    netByUser.set(b.user_id as string, (netByUser.get(b.user_id as string) ?? 0) + delta)
  }

  // 🧸 Fidusbamser: pr. AFGJORT runde får topscoreren (flest point) en bamse.
  // Uafgjort på toppen → alle med max (> 0) får hver én.
  const mvpByUser = new Map<string, number>()
  const ptsByRound = new Map<number, Map<string, number>>()
  for (const s of scores ?? []) {
    const rid = s.round_id as number
    if (!finishedRoundIds.has(rid)) continue
    if (!ptsByRound.has(rid)) ptsByRound.set(rid, new Map())
    const m = ptsByRound.get(rid)!
    m.set(s.user_id, (m.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0))
  }
  for (const [, userPts] of ptsByRound) {
    let max = 0
    for (const v of userPts.values()) if (v > max) max = v
    if (max > 0) for (const [uid, v] of userPts) if (v === max) mvpByUser.set(uid, (mvpByUser.get(uid) ?? 0) + 1)
  }

  return { leaderboard: buildEntries(members, userData, roundWins, blockWins, totalByUser, netByUser, mvpByUser) }
}

// Tæl historiske blok-vindere ved at aggregere alle finished blocks separat.
async function countHistoricalBlockWins(
  gameId: number,
  members: { user_id: string }[],
  rounds: { id: number; block_id?: number | null; status: string }[],
  finishedBlockIds: Set<number>,
): Promise<Map<string, number>> {
  if (finishedBlockIds.size === 0) return new Map()

  const finishedBlockRoundIds = (rounds ?? [])
    .filter((r) => r.block_id != null && finishedBlockIds.has(r.block_id))
    .map((r) => r.id)

  if (finishedBlockRoundIds.length === 0) return new Map()

  const { data: scores } = await supabaseAdmin
    .from('round_scores')
    .select('user_id, round_id, earnings_delta')
    .eq('game_id', gameId)
    .in('round_id', finishedBlockRoundIds)

  // pointsPerBlockPerUser[block_id][user_id] = total
  const blockPoints = new Map<number, Map<string, number>>()
  for (const m of members) {
    for (const bid of finishedBlockIds) {
      if (!blockPoints.has(bid)) blockPoints.set(bid, new Map())
      blockPoints.get(bid)!.set(m.user_id, 0)
    }
  }

  const roundToBlock = new Map<number, number>()
  for (const r of rounds) if (r.block_id != null) roundToBlock.set(r.id, r.block_id)

  for (const s of scores ?? []) {
    const bid = roundToBlock.get(s.round_id as number)
    if (!bid || !finishedBlockIds.has(bid)) continue
    const userMap = blockPoints.get(bid)!
    userMap.set(s.user_id, (userMap.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0))
  }

  // Vinder = højeste samlede profit i blokken. Uafgjort → ALLE med max-profit
  // (> 0) får hver en blok-sejr (matcher reglen i evaluateFinishedBlocks).
  const wins = new Map<string, number>()
  for (const [, userMap] of blockPoints) {
    let topPts = -Infinity
    for (const [, pts] of userMap) if (pts > topPts) topPts = pts
    if (topPts > 0) {
      for (const [uid, pts] of userMap) {
        if (pts === topPts) wins.set(uid, (wins.get(uid) ?? 0) + 1)
      }
    }
  }
  return wins
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
  // Hent ALLE blocks (top + sub). Både top- og sub-blokke tæller som
  // "blok-sejre" — så Giro Uge 1, Uge 2 osv. hver giver én sejr til vinderen.
  // sub-blokke (uger i et stage race) bruges desuden til at finde "aktiv uge" så
  // block_points afspejler regnskab pr. hviledag i en GT.
  const { data: cyclingBlocks } = await supabaseAdmin
    .from('cycling_blocks')
    .select('id, name, block_order, status, parent_block_id, stage_number_min, stage_number_max, winner_user_id')
    .eq('game_id', gameId)
    .order('block_order', { ascending: true })

  const allBlocks = (cyclingBlocks ?? []) as {
    id: string
    name: string
    block_order: number
    status: string
    parent_block_id: string | null
    stage_number_min: number | null
    stage_number_max: number | null
    winner_user_id: string | null
  }[]
  const topBlocks = allBlocks.filter((b) => b.parent_block_id === null)
  const finishedBlockIds = new Set(
    topBlocks.filter((b) => b.status === 'finished').map((b) => b.id),
  )

  // "Nuværende" blok = laveste block_order der ikke er finished.
  // Hvis alle er finished → seneste (højeste block_order).
  const currentBlock =
    topBlocks.find((b) => b.status !== 'finished') ??
    [...topBlocks].reverse()[0] ??
    null
  const currentBlockId = currentBlock?.id ?? null

  // Hent race → block mapping for nuværende blok
  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id, cycling_block_id')
    .eq('game_id', gameId)

  const currentBlockRaceIds = new Set(
    (gameRaces ?? [])
      .filter((gr) => gr.cycling_block_id === currentBlockId)
      .map((gr) => gr.race_id as string),
  )

  // Find aktiv sub-blok under nuværende top-blok (hvis nogen). block_points
  // afspejler så regnskab pr. uge (hviledag) i en Grand Tour.
  const currentSubBlocks = currentBlockId
    ? allBlocks.filter((b) => b.parent_block_id === currentBlockId)
    : []
  let activeSubBlockId: string | null = null
  let activeSubBlockRange: { min: number; max: number } | null = null
  if (currentSubBlocks.length > 0 && currentBlockRaceIds.size > 0) {
    const { data: stagesData } = await supabaseAdmin
      .from('cycling_stages')
      .select('stage_number, results_uploaded_at, race_id')
      .in('race_id', [...currentBlockRaceIds])
    const active = findActiveSubBlock(currentSubBlocks, stagesData ?? [])
    if (active) {
      activeSubBlockId = active.id
      activeSubBlockRange = getBlockStageRange(active)
    }
  }

  // Hent alle scores for spilrummet — inkl. stage_number til sub-blok-filtrering.
  const { data: scores } = await supabaseAdmin
    .from('cycling_scores')
    .select('stage_id, race_id, total_points, cycling_stages!inner(stage_number), cycling_lineups!inner(squad_id, cycling_squads!inner(user_id, game_id))')
    .eq('cycling_lineups.cycling_squads.game_id', gameId)

  // userData rummer KUN nuværende blok-data
  const userData = new Map<string, { roundPoints: Map<string, number>; blockPoints: Map<string, number> }>()
  for (const m of members) {
    userData.set(m.user_id, { roundPoints: new Map(), blockPoints: new Map() })
  }
  // Sammenlagt point på tværs af ALLE blokke — bruges af sæson-overblik.
  // Beregnes fra samme scores-loop, bare uden current-block-filter.
  const totalPointsByUser = new Map<string, number>()
  for (const m of members) totalPointsByUser.set(m.user_id, 0)

  for (const s of scores ?? []) {
    const lineup = s.cycling_lineups as unknown as { squad_id: string; cycling_squads: { user_id: string } }
    const userId = lineup?.cycling_squads?.user_id
    if (!userId) continue
    const pts = Number(s.total_points) || 0

    // Sæson-total: tæller scores fra alle blokke
    totalPointsByUser.set(userId, (totalPointsByUser.get(userId) ?? 0) + pts)

    // Nuværende blok / sub-blok — filtrér til kun aktive blok-races
    if (!currentBlockRaceIds.has(s.race_id as string)) continue
    if (activeSubBlockRange) {
      const stage = s.cycling_stages as unknown as { stage_number: number } | null
      const sn = stage?.stage_number
      if (sn == null || sn < activeSubBlockRange.min || sn > activeSubBlockRange.max) continue
    }

    const ud = userData.get(userId)
    if (!ud) continue

    const stageId = s.stage_id as string
    ud.roundPoints.set(stageId, (ud.roundPoints.get(stageId) ?? 0) + pts)
    const aggregateBlockId = activeSubBlockId ?? currentBlockId
    if (aggregateBlockId) ud.blockPoints.set(aggregateBlockId, (ud.blockPoints.get(aggregateBlockId) ?? 0) + pts)
  }

  // R. SEJR = stage-vindere i nuværende blok (alle scorede stages tæller)
  const stageIdsInCurrent = new Set<string>()
  for (const ud of userData.values()) for (const sid of ud.roundPoints.keys()) stageIdsInCurrent.add(sid)

  const roundWins = countWins(userData, 'roundPoints', stageIdsInCurrent)

  // B. SEJR = antal TOP-blokke (samlede sejre / "løb-vinder") hvor user_id
  // er gemt som winner_user_id. Sub-blokke (uger) tæller IKKE — ellers ville
  // en GT-vinder blive talt 4 gange (1 samlet + 3 uger). Uge-sejre vises
  // separat via CyclingBlockStanding.
  const blockWins = new Map<string, number>()
  for (const b of allBlocks) {
    if (!b.winner_user_id) continue
    if (b.parent_block_id != null) continue  // skip sub-blokke
    blockWins.set(b.winner_user_id, (blockWins.get(b.winner_user_id) ?? 0) + 1)
  }

  return { leaderboard: buildEntries(members, userData, roundWins, blockWins, totalPointsByUser) }
}

// ─── getActiveBlockStandings ────────────────────────────────────────────────
// Kun for fodbold (regular, ikke-championship). Returnerer stillingen i den
// aktive blok baseret på runder med score — opdateres live efter hver kamp
// da calculateRoundPoints upserter round_scores per finished match.

export async function getActiveBlockStandings(
  gameId: number,
): Promise<ActiveBlockStandings> {
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map((gs) => gs.season_id as number)
  if (seasonIds.length === 0) return null

  const { data: blocks } = await supabaseAdmin
    .from('blocks')
    .select('id, season_id, block_number, name, status')
    .in('season_id', seasonIds)

  const activeBlock = (blocks ?? []).find((b) => b.status === 'active') ?? null
  if (!activeBlock) return null

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, block_id, status')
    .eq('block_id', activeBlock.id)

  const blockRoundIds = (rounds ?? []).map((r) => r.id as number)
  if (blockRoundIds.length === 0) return null

  const finishedRoundIds = new Set(
    (rounds ?? []).filter((r) => r.status === 'finished').map((r) => r.id)
  )

  const { data: scores } = await supabaseAdmin
    .from('round_scores')
    .select('user_id, round_id, earnings_delta')
    .eq('game_id', gameId)
    .in('round_id', blockRoundIds)

  const earningsByUser = new Map<string, number>()
  for (const s of scores ?? []) {
    if (!finishedRoundIds.has(s.round_id)) continue
    earningsByUser.set(
      s.user_id,
      (earningsByUser.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0),
    )
  }

  // Hent usernames
  const userIds = [...earningsByUser.keys()]
  const usernameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      usernameMap.set(p.id as string, p.username as string)
    }
  }

  const raw = [...earningsByUser.entries()]
    .map(([user_id, total]) => ({
      user_id,
      username: usernameMap.get(user_id) ?? 'Ukendt',
      total,
    }))
    .sort((a, b) => b.total - a.total)

  let rank = 1
  const rows: BlockStandingRow[] = raw.map((row, i, arr) => {
    if (i > 0 && row.total < arr[i - 1].total) rank = i + 1
    return { ...row, rank }
  })

  return {
    block_id: activeBlock.id as number,
    block_name: (activeBlock.name as string) ?? '',
    block_number: (activeBlock.block_number as number) ?? 0,
    rounds_remaining: blockRoundIds.length - finishedRoundIds.size,
    rows,
  }
}

// ─── getBlockWinners — historik over afgjorte blokke + vinder(e) ────────────

export type BlockWinnerRow = {
  block_number: number
  block_name: string
  winners: { user_id: string; username: string; avatar_url: string | null; points_in_block: number }[]
}

export async function getBlockWinners(gameId: number): Promise<BlockWinnerRow[]> {
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons').select('season_id').eq('game_id', gameId)
  const seasonIds = (gameSeasons ?? []).map((g) => g.season_id as number)
  if (seasonIds.length === 0) return []

  const { data: blocks } = await supabaseAdmin
    .from('blocks')
    .select('id, block_number, name, status')
    .in('season_id', seasonIds)
    .eq('status', 'finished')
    .order('block_number', { ascending: true })
  if (!blocks?.length) return []

  const { data: winners } = await supabaseAdmin
    .from('block_winners')
    .select('block_id, user_id, points_in_block')
    .eq('game_id', gameId)
    .in('block_id', blocks.map((b) => b.id))

  const userIds = [...new Set((winners ?? []).map((w) => w.user_id as string))]
  const { data: profs } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, username, avatar_url').in('id', userIds)
    : { data: [] as { id: string; username: string; avatar_url: string | null }[] }
  const profById = new Map((profs ?? []).map((p) => [p.id, p]))

  const byBlock = new Map<number, BlockWinnerRow['winners']>()
  for (const w of winners ?? []) {
    const arr = byBlock.get(w.block_id as number) ?? []
    const p = profById.get(w.user_id as string)
    arr.push({
      user_id: w.user_id as string,
      username: p?.username ?? 'Ukendt',
      avatar_url: p?.avatar_url ?? null,
      points_in_block: Number(w.points_in_block) || 0,
    })
    byBlock.set(w.block_id as number, arr)
  }

  // Nyeste blok øverst
  return [...blocks].reverse().map((b) => ({
    block_number: b.block_number as number,
    block_name: (b.name as string) ?? `Blok ${b.block_number}`,
    winners: (byBlock.get(b.id as number) ?? []).sort((a, z) => z.points_in_block - a.points_in_block),
  }))
}

// ─── getPlayerHistory — drill-down: pr-runde bets, point & profit ───────────

export type PlayerHistory = {
  username: string
  totals: { staked: number; won: number; net: number }
  rounds: {
    round_id: number
    round_name: string
    block_number: number | null
    status: string
    staked: number
    won: number
    net: number
    settled: boolean
    bets: {
      label: string
      bet_type: string
      prediction: string
      stake: number
      odds: number | null
      result: string | null
      points_earned: number | null
    }[]
  }[]
}

export async function getPlayerHistory(gameId: number, userId: string): Promise<PlayerHistory | null> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single()

  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('round_id, match_id, bet_type, prediction, stake, odds, result, points_earned')
    .eq('game_id', gameId)
    .eq('user_id', userId)
  if (!bets?.length) {
    return { username: prof?.username ?? 'Ukendt', totals: { staked: 0, won: 0, net: 0 }, rounds: [] }
  }

  const roundIds = [...new Set(bets.map((b) => b.round_id as number).filter(Boolean))]
  const matchIds = [...new Set(bets.map((b) => b.match_id as number))]

  const [{ data: rounds }, { data: matches }] = await Promise.all([
    supabaseAdmin.from('rounds').select('id, name, block_id, status').in('id', roundIds),
    supabaseAdmin.from('matches').select('id, home_team_id, away_team_id').in('id', matchIds),
  ])
  const blockIds = [...new Set((rounds ?? []).map((r) => r.block_id).filter((b): b is number => b != null))]
  const teamIds = [...new Set((matches ?? []).flatMap((m) => [m.home_team_id, m.away_team_id]).filter((t): t is number => t != null))]
  const [{ data: blocks }, { data: teams }] = await Promise.all([
    blockIds.length ? supabaseAdmin.from('blocks').select('id, block_number').in('id', blockIds) : Promise.resolve({ data: [] as { id: number; block_number: number }[] }),
    teamIds.length ? supabaseAdmin.from('teams').select('id, name').in('id', teamIds) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
  ])
  const blockNumById = new Map((blocks ?? []).map((b) => [b.id, b.block_number]))
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))
  const matchLabel = new Map(
    (matches ?? []).map((m) => [m.id, `${teamName.get(m.home_team_id as number) ?? '?'} – ${teamName.get(m.away_team_id as number) ?? '?'}`]),
  )
  const roundById = new Map((rounds ?? []).map((r) => [r.id, r]))

  const byRound = new Map<number, PlayerHistory['rounds'][number]>()
  let tStaked = 0, tWon = 0
  for (const b of bets) {
    // KUN afgjorte spil — man skal ikke kunne se andres kommende/uafgjorte bets.
    const settled = b.result === 'win' || b.result === 'loss'
    if (!settled) continue

    const rid = b.round_id as number
    const r = roundById.get(rid)
    if (!byRound.has(rid)) {
      byRound.set(rid, {
        round_id: rid,
        round_name: (r?.name as string) ?? `Runde ${rid}`,
        block_number: r?.block_id != null ? blockNumById.get(r.block_id) ?? null : null,
        status: (r?.status as string) ?? 'unknown',
        staked: 0, won: 0, net: 0, settled: true, bets: [],
      })
    }
    const row = byRound.get(rid)!
    const stake = Number(b.stake) || 0
    const won = Number(b.points_earned) || 0
    row.staked += stake
    row.won += won
    tStaked += stake
    tWon += won
    row.bets.push({
      label: matchLabel.get(b.match_id as number) ?? '—',
      bet_type: b.bet_type as string,
      prediction: b.prediction as string,
      stake,
      odds: (b.odds as number | null) ?? null,
      result: (b.result as string | null) ?? null,
      points_earned: (b.points_earned as number | null) ?? null,
    })
  }
  for (const row of byRound.values()) row.net = row.won - row.staked

  const roundsArr = [...byRound.values()].sort((a, z) => z.round_id - a.round_id)
  return {
    username: prof?.username ?? 'Ukendt',
    totals: { staked: tStaked, won: tWon, net: tWon - tStaked },
    rounds: roundsArr,
  }
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

  const isFootballRegular = (game.sport ?? 'football') === 'football' && game.championship_mode !== true

  const [matchesResult, leaderboardResult, blockStandings] = await Promise.all([
    getGameMatches(gameId, userId),
    getGameLeaderboard(gameId),
    isFootballRegular ? getActiveBlockStandings(gameId) : Promise.resolve(null),
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
    activeBlockStandings: blockStandings,
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
  totalPointsByUser?: Map<string, number>,
  netProfitByUser?: Map<string, number>,
  mvpByUser?: Map<string, number>,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = members.map((m) => {
    const profile = m.profiles as { username: string; avatar_url: string | null }
    const ud = userData.get(m.user_id)

    let totalRoundPoints = 0
    if (ud) for (const pts of ud.roundPoints.values()) totalRoundPoints += pts

    let totalBlockPoints = 0
    if (ud) for (const pts of ud.blockPoints.values()) totalBlockPoints += pts

    // Hvis totalPointsByUser ikke er sat (fodbold), brug summen over nuværende
    // blok som approksimation. Sæson-overblik for cykling kalder med kortet sat.
    const totalPoints = totalPointsByUser?.get(m.user_id) ?? totalBlockPoints

    return {
      user_id: m.user_id,
      username: profile?.username ?? 'Anonym',
      avatar_url: profile?.avatar_url ?? null,
      round_wins: roundWins.get(m.user_id) ?? 0,
      round_points: Math.round(totalRoundPoints * 10) / 10,
      block_wins: blockWins.get(m.user_id) ?? 0,
      block_points: Math.round(totalBlockPoints * 10) / 10,
      total_points: Math.round(totalPoints * 10) / 10,
      net_profit: Math.round((netProfitByUser?.get(m.user_id) ?? 0) * 10) / 10,
      mvp_count: mvpByUser?.get(m.user_id) ?? 0,
    }
  })
  // Sortér: B. SEJR (historiske trofæer) → B. PT i nuværende blok → R. PT
  entries.sort((a, b) =>
    b.block_wins - a.block_wins ||
    b.block_points - a.block_points ||
    b.round_points - a.round_points,
  )
  return entries
}
