import { supabaseAdmin } from '@/lib/supabase'
import { calculateHistoricFactors } from './historicFactor'
import { BET_TYPES } from './betTypes'

// Sværhedsgrader matcher præcise prediction-værdier
const EXTRA_BET_DIFFICULTY: Record<string, number> = {
  [`${BET_TYPES.BTTS}_yes`]: 1.2,
  [`${BET_TYPES.BTTS}_no`]: 1.4,
  [`${BET_TYPES.OVER_UNDER}_over`]: 1.2,
  [`${BET_TYPES.OVER_UNDER}_under`]: 1.4,
  [`${BET_TYPES.HALVLEG}_h1`]: 1.6,
  [`${BET_TYPES.HALVLEG}_h2`]: 1.3,
  [`${BET_TYPES.HALVLEG}_draw`]: 2.5,
  [`${BET_TYPES.MALFORSKEL}_2plus`]: 1.4,
  [`${BET_TYPES.MALFORSKEL}_1goal`]: 1.8,
  [`${BET_TYPES.MALFORSKEL}_udraw`]: 2.0,
}

function getStreakBonus(streak: number): number {
  if (streak >= 5) return 1.5
  if (streak === 4) return 1.3
  if (streak === 3) return 1.2
  if (streak === 2) return 1.1
  return 1.0
}

function getKonsensus(sameCount: number, totalCount: number): number {
  if (totalCount === 0) return 1.0
  const pct = sameCount / totalCount
  if (pct >= 1.0) return 1.0
  if (pct >= 0.75) return 1.0 + (1 - pct) * 0.8
  if (pct >= 0.5) return 1.2 + (0.75 - pct) * 1.2
  if (pct >= 0.25) return 1.5 + (0.5 - pct) * 2.0
  if (pct >= 0.1) return 2.0 + (0.25 - pct) * 6.7
  if (pct > 0) return 3.0 + (0.1 - pct) * 20.0
  return 5.0
}

// Tjek om prediction er korrekt
function isBetCorrect(
  betType: string,
  prediction: string,
  homeScore: number,
  awayScore: number,
  homeHtScore?: number | null,
  awayHtScore?: number | null
): boolean {
  const total = homeScore + awayScore
  const diff = Math.abs(homeScore - awayScore)

  switch (betType) {
    case BET_TYPES.MATCH_RESULT:
      if (prediction === '1') return homeScore > awayScore
      if (prediction === 'X') return homeScore === awayScore
      if (prediction === '2') return awayScore > homeScore
      return false

    case BET_TYPES.BTTS:
      if (prediction === 'yes' || prediction === 'ja') return homeScore > 0 && awayScore > 0
      if (prediction === 'no' || prediction === 'nej') return !(homeScore > 0 && awayScore > 0)
      return false

    case BET_TYPES.OVER_UNDER:
      if (prediction === 'over') return total > 2.5
      if (prediction === 'under') return total <= 2.5
      return false

    case BET_TYPES.HALVLEG:
    case 'halftime':
      if (homeHtScore == null || awayHtScore == null) return false
      if (prediction === 'h1') return homeHtScore > awayHtScore
      if (prediction === 'h2') return homeHtScore < awayHtScore
      if (prediction === 'draw') return homeHtScore === awayHtScore
      return false

    case BET_TYPES.MALFORSKEL:
      if (prediction === '2plus' || prediction === '2+') return diff >= 2
      if (prediction === '1goal' || prediction === '1') return diff === 1
      if (prediction === 'udraw' || prediction === 'draw') return diff === 0
      return false

    default:
      return false
  }
}

// Hent historisk faktor baseret på bet_type
function getHistoricFactor(
  betType: string,
  prediction: string,
  historicFactors: { home: number; draw: number; away: number }
): number {
  if (betType === BET_TYPES.MATCH_RESULT) {
    if (prediction === '1') return historicFactors.home
    if (prediction === 'X') return historicFactors.draw
    if (prediction === '2') return historicFactors.away
  }
  // Normaliser prediction til key (legacy-værdier for malforskel)
  const norm =
    betType === BET_TYPES.MALFORSKEL
      ? prediction.replace('2+', '2plus').replace(/^1$/, '1goal').replace(/^draw$/, 'udraw')
      : prediction
  return EXTRA_BET_DIFFICULTY[`${betType}_${norm}`] ?? EXTRA_BET_DIFFICULTY[`${betType}_${prediction}`] ?? 1.3
}

export async function calculateRoundPoints(roundId: number): Promise<void> {
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, home_ht_score, away_ht_score, status')
    .eq('round_id', roundId)
    .eq('status', 'finished')

  if (!matches?.length) return

  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('league_id, wildcard_match_id')
    .eq('id', roundId)
    .single()

  if (!round) return

  const leagueId = round.league_id as number | null
  const wildcardMatchId = round.wildcard_match_id as number | null
  const matchIds = matches.map((m) => m.id)

  // Hent ALLE unikke game_ids fra bets for denne rundes kampe
  const { data: betGameRows } = await supabaseAdmin
    .from('bets')
    .select('game_id')
    .in('match_id', matchIds)

  const allGameIds = [...new Set((betGameRows ?? []).map((b) => b.game_id as number))]
  if (allGameIds.length === 0) return

  // Hent rivalries for denne liga (begge retninger: A-B og B-A)
  let rivalryMap = new Map<string, number>()
  if (leagueId) {
    const { data: rivalries } = await supabaseAdmin
      .from('rivalries')
      .select('home_team, away_team, multiplier')
      .eq('league_id', leagueId)
    for (const r of rivalries ?? []) {
      const key1 = `${r.home_team}|${r.away_team}`
      const key2 = `${r.away_team}|${r.home_team}`
      rivalryMap.set(key1, Number(r.multiplier))
      rivalryMap.set(key2, Number(r.multiplier))
    }
  }

  // Kør point-beregning for hvert spilrum separat
  for (const gameId of allGameIds) {
    const extraBetsCorrectByUser = new Map<string, number>()

    for (const match of matches) {
      if (match.home_score === null || match.away_score === null) continue

      const { data: bets } = await supabaseAdmin
        .from('bets')
        .select('id, user_id, prediction, stake, bet_type, result')
        .eq('match_id', match.id)
        .eq('game_id', gameId)
        .is('result', null)

      if (!bets?.length) continue

      const historicFactors = await calculateHistoricFactors(
        match.home_team,
        match.away_team,
        leagueId
      )

      const predictionCounts = new Map<string, number>()
      for (const bet of bets) {
        predictionCounts.set(bet.prediction, (predictionCounts.get(bet.prediction) ?? 0) + 1)
      }
      const totalBets = bets.length

      for (const bet of bets) {
        const isCorrect = isBetCorrect(
          bet.bet_type,
          bet.prediction,
          match.home_score,
          match.away_score,
          match.home_ht_score,
          match.away_ht_score
        )

        if (!isCorrect) {
          await supabaseAdmin
            .from('bets')
            .update({ result: 'loss', points_delta: 0 })
            .eq('id', bet.id)
          continue
        }

        const { data: member } = await supabaseAdmin
          .from('game_members')
          .select('points, current_streak, total_wins, total_losses')
          .eq('game_id', gameId)
          .eq('user_id', bet.user_id)
          .single()

        const streak = (member as { current_streak?: number } | null)?.current_streak ?? 0
        const streakBonus = getStreakBonus(streak)

        const sameCount = predictionCounts.get(bet.prediction) ?? 1
        const konsensus = getKonsensus(sameCount, totalBets)
        const historisk = getHistoricFactor(bet.bet_type, bet.prediction, historicFactors)
        let pointsEarned = Math.round(bet.stake * konsensus * historisk * streakBonus)

        // Rivalry multiplier (×1.5) for matches between rival teams
        const rivalryKey = `${match.home_team}|${match.away_team}`
        const rivalryMultiplier = rivalryMap.get(rivalryKey) ?? 1.0
        pointsEarned = Math.round(pointsEarned * rivalryMultiplier)

        await supabaseAdmin
          .from('bets')
          .update({
            result: 'win',
            points_delta: pointsEarned,
          })
          .eq('id', bet.id)

        // Track extra bets correct (non-match_result)
        if (bet.bet_type !== BET_TYPES.MATCH_RESULT) {
          extraBetsCorrectByUser.set(bet.user_id, (extraBetsCorrectByUser.get(bet.user_id) ?? 0) + 1)
        }

        const currentPoints = member?.points ?? 0
        const totalWins = (member as { total_wins?: number } | null)?.total_wins ?? 0

        await supabaseAdmin
          .from('game_members')
          .update({
            points: currentPoints + pointsEarned,
            current_streak: streak + 1,
            total_wins: totalWins + 1,
          })
          .eq('game_id', gameId)
          .eq('user_id', bet.user_id)
      }

      const losingUserIds = bets
        .filter((b) => {
          const correct = isBetCorrect(
            b.bet_type,
            b.prediction,
            match.home_score!,
            match.away_score!,
            match.home_ht_score,
            match.away_ht_score
          )
          return !correct
        })
        .map((b) => b.user_id)

      for (const userId of losingUserIds) {
        const { data: member } = await supabaseAdmin
          .from('game_members')
          .select('total_losses')
          .eq('game_id', gameId)
          .eq('user_id', userId)
          .single()

        const totalLosses = (member as { total_losses?: number } | null)?.total_losses ?? 0

        await supabaseAdmin
          .from('game_members')
          .update({
            current_streak: 0,
            total_losses: totalLosses + 1,
          })
          .eq('game_id', gameId)
          .eq('user_id', userId)
      }
    }

    // Aggregér point per bruger og beregn earnings_delta (med wildcard ×2)
    const { data: allBetsInRound } = await supabaseAdmin
      .from('bets')
      .select('user_id, points_delta, match_id')
      .eq('game_id', gameId)
      .in('match_id', matchIds)
      .not('points_delta', 'is', null)

    const pointsByUser = new Map<string, number>()
    const earningsDeltaByUser = new Map<string, number>()

    for (const b of allBetsInRound ?? []) {
      pointsByUser.set(b.user_id, (pointsByUser.get(b.user_id) ?? 0) + (b.points_delta ?? 0))
      // earnings_delta: wildcard match contribution doubled
      const matchPoints = b.points_delta ?? 0
      const wildcardMultiplier = b.match_id === wildcardMatchId ? 2.0 : 1.0
      const earningsContrib = Math.round(matchPoints * wildcardMultiplier)
      earningsDeltaByUser.set(b.user_id, (earningsDeltaByUser.get(b.user_id) ?? 0) + earningsContrib)
    }

    // Inkluder alle brugere der har afgivet bets i runden (også dem der kun tabte)
    const { data: allBetsForRound } = await supabaseAdmin
      .from('bets')
      .select('user_id')
      .eq('game_id', gameId)
      .in('match_id', matchIds)
    const allUserIds = new Set((allBetsForRound ?? []).map((b) => b.user_id))
    for (const userId of allUserIds) {
      const pointsEarned = pointsByUser.get(userId) ?? 0
      const earningsDelta = earningsDeltaByUser.get(userId) ?? 0
      const extraBetsCorrect = extraBetsCorrectByUser.get(userId) ?? 0

      await supabaseAdmin.from('round_scores').upsert(
        {
          user_id: userId,
          round_id: roundId,
          game_id: gameId,
          points_earned: pointsEarned,
          earnings_delta: earningsDelta,
          extra_bets_correct: extraBetsCorrect,
        },
        { onConflict: 'user_id,round_id' }
      )

      // Opdater game_members.earnings
      const { data: member } = await supabaseAdmin
        .from('game_members')
        .select('earnings')
        .eq('game_id', gameId)
        .eq('user_id', userId)
        .single()
      const currentEarnings = (member as { earnings?: number } | null)?.earnings ?? 0
      await supabaseAdmin
        .from('game_members')
        .update({ earnings: currentEarnings + earningsDelta })
        .eq('game_id', gameId)
        .eq('user_id', userId)

      if (pointsEarned > 0) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single()

        const totalPoints = (profile?.points ?? 0) + pointsEarned
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ points: totalPoints })
          .eq('id', userId)

        if (error) console.error('Failed to update profiles.points:', error)
      }
    }

    await awardRoundBonus(roundId, gameId, matchIds)
    await awardFullHouseBonus(gameId, matchIds, matches.length)

    // Reset betting_balance til 1000 for alle game_members i dette spilrum
    await supabaseAdmin
      .from('game_members')
      .update({ betting_balance: 1000 })
      .eq('game_id', gameId)
  }

  await supabaseAdmin.from('rounds').update({ status: 'finished' }).eq('id', roundId)
}

async function awardRoundBonus(
  roundId: number,
  gameId: number,
  matchIds: number[]
): Promise<void> {
  if (matchIds.length === 0) return

  const { data: roundBets } = await supabaseAdmin
    .from('bets')
    .select('user_id, points_delta')
    .eq('game_id', gameId)
    .in('match_id', matchIds)
    .eq('result', 'win')

  if (!roundBets?.length) return

  const winMap = new Map<string, number>()
  for (const b of roundBets) {
    winMap.set(b.user_id, (winMap.get(b.user_id) ?? 0) + 1)
  }

  const maxWins = Math.max(...winMap.values())
  const winners = [...winMap.entries()].filter(([, wins]) => wins === maxWins)
  const bonus = winners.length === 1 ? 100 : 50

  for (const [userId] of winners) {
    const { data: m } = await supabaseAdmin
      .from('game_members')
      .select('points, earnings')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .single()

    if (m) {
      const member = m as { points?: number; earnings?: number }
      await supabaseAdmin
        .from('game_members')
        .update({
          points: (member.points ?? 0) + bonus,
          earnings: (member.earnings ?? 0) + bonus,
        })
        .eq('game_id', gameId)
        .eq('user_id', userId)

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('points')
        .eq('id', userId)
        .single()
      const totalPoints = (profile?.points ?? 0) + bonus
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ points: totalPoints })
        .eq('id', userId)
      if (error) console.error('Failed to update profiles.points (round bonus):', error)
    }
  }
}

async function awardFullHouseBonus(
  gameId: number,
  matchIds: number[],
  totalMatches: number
): Promise<void> {
  if (matchIds.length === 0) return

  const { data: allBets } = await supabaseAdmin
    .from('bets')
    .select('user_id, match_id')
    .eq('game_id', gameId)
    .eq('bet_type', BET_TYPES.MATCH_RESULT)
    .in('match_id', matchIds)

  if (!allBets?.length) return

  const betCountPerUser = new Map<string, Set<number>>()
  for (const b of allBets) {
    if (!betCountPerUser.has(b.user_id)) betCountPerUser.set(b.user_id, new Set())
    betCountPerUser.get(b.user_id)!.add(b.match_id)
  }

  for (const [userId, matchIdsSet] of betCountPerUser) {
    if (matchIdsSet.size === totalMatches) {
      const { data: m } = await supabaseAdmin
        .from('game_members')
        .select('points, earnings')
        .eq('game_id', gameId)
        .eq('user_id', userId)
        .single()

      if (m) {
        const fullHouseBonus = 25
        const member = m as { points?: number; earnings?: number }
        await supabaseAdmin
          .from('game_members')
          .update({
            points: (member.points ?? 0) + fullHouseBonus,
            earnings: (member.earnings ?? 0) + fullHouseBonus,
          })
          .eq('game_id', gameId)
          .eq('user_id', userId)

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single()
        const totalPoints = (profile?.points ?? 0) + fullHouseBonus
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ points: totalPoints })
          .eq('id', userId)
        if (error) console.error('Failed to update profiles.points (full house):', error)
      }
    }
  }
}

/**
 * Synkroniserer profiles.points med summen af game_members.points for hver bruger.
 * Køres efter calculateRoundPoints for at sikre profiles.points altid afspejler total point.
 */
export async function syncProfilesPoints(): Promise<{ updated: number }> {
  const { data: members } = await supabaseAdmin
    .from('game_members')
    .select('user_id, points')

  if (!members?.length) return { updated: 0 }

  const pointsByUser = new Map<string, number>()
  for (const m of members) {
    const uid = m.user_id as string
    const pts = m.points ?? 0
    pointsByUser.set(uid, (pointsByUser.get(uid) ?? 0) + pts)
  }

  let updated = 0
  for (const [userId, totalPoints] of pointsByUser) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ points: totalPoints })
      .eq('id', userId)

    if (!error) updated++
    else console.error(`[syncProfilesPoints] Fejl for user ${userId}:`, error.message)
  }

  return { updated }
}
