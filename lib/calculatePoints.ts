import { supabaseAdmin } from '@/lib/supabase'
import { isBetCorrect } from './betUtils'

/**
 * V1 — Simpel, idempotent pointberegning.
 *
 * PRINCIP:
 *   Korrekt bet → stake × 2 (stake + gevinst)
 *   Forkert bet → 0 (mister stake)
 *   earnings_delta = SUM(points_earned) - SUM(stake)  per runde
 *   game_members.earnings = SUM(round_scores.earnings_delta) (absolut, aldrig relativt)
 *
 * Kan køres mange gange — upsert overalt, sætter absolut.
 */

export async function calculateRoundPoints(roundId: number): Promise<void> {
  // 1. Hent finished matches for runden
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, home_ht_score, away_ht_score, status')
    .eq('round_id', roundId)
    .eq('status', 'finished')

  if (!matches?.length) return

  const matchIds = matches.map((m) => m.id)

  // Find alle unikke game_ids fra bets for denne rundes kampe
  const { data: betGameRows } = await supabaseAdmin
    .from('bets')
    .select('game_id')
    .in('match_id', matchIds)

  const allGameIds = [...new Set((betGameRows ?? []).map((b) => b.game_id as number))]
  if (allGameIds.length === 0) return

  // 2. For hvert game: evaluer bets, beregn earnings, upsert round_scores
  for (const gameId of allGameIds) {
    // 2a. Evaluer alle bets for alle finished matches i runden
    for (const match of matches) {
      if (match.home_score === null || match.away_score === null) continue

      const { data: bets } = await supabaseAdmin
        .from('bets')
        .select('id, user_id, prediction, stake, bet_type')
        .eq('match_id', match.id)
        .eq('game_id', gameId)

      if (!bets?.length) continue

      for (const bet of bets) {
        // Halvleg: skip hvis HT-scores mangler
        if (
          (bet.bet_type === 'halvleg' || bet.bet_type === 'halftime') &&
          (match.home_ht_score == null || match.away_ht_score == null)
        ) {
          await supabaseAdmin
            .from('bets')
            .update({ result: 'pending', points_earned: 0, points_delta: 0 })
            .eq('id', bet.id)
          continue
        }

        const correct = isBetCorrect(
          bet.bet_type,
          bet.prediction,
          match.home_score,
          match.away_score,
          match.home_ht_score,
          match.away_ht_score
        )

        const stake = bet.stake ?? 0
        const pointsEarned = correct ? stake * 2 : 0
        const result = correct ? 'win' : 'loss'

        await supabaseAdmin
          .from('bets')
          .update({ result, points_earned: pointsEarned, points_delta: pointsEarned })
          .eq('id', bet.id)
      }
    }

    // 2b. Beregn earnings_delta per bruger i denne runde
    //     earnings_delta = SUM(points_earned) - SUM(stake)
    const { data: roundBets } = await supabaseAdmin
      .from('bets')
      .select('user_id, stake, points_earned')
      .eq('game_id', gameId)
      .in('match_id', matchIds)

    if (!roundBets?.length) continue

    // Gruppér per bruger
    const userStats = new Map<string, { totalStake: number; totalEarned: number }>()
    for (const b of roundBets) {
      const uid = b.user_id as string
      const entry = userStats.get(uid) ?? { totalStake: 0, totalEarned: 0 }
      entry.totalStake += b.stake ?? 0
      entry.totalEarned += b.points_earned ?? 0
      userStats.set(uid, entry)
    }

    // 2c. Upsert round_scores
    for (const [userId, stats] of userStats) {
      const earningsDelta = stats.totalEarned - stats.totalStake

      await supabaseAdmin.from('round_scores').upsert(
        {
          user_id: userId,
          round_id: roundId,
          game_id: gameId,
          points_earned: stats.totalEarned,
          earnings_delta: earningsDelta,
        },
        { onConflict: 'user_id,round_id,game_id' }
      )
    }

    // 3. Sæt game_members.earnings = SUM(round_scores.earnings_delta) (absolut)
    const { data: members } = await supabaseAdmin
      .from('game_members')
      .select('user_id')
      .eq('game_id', gameId)

    for (const member of members ?? []) {
      const { data: scores } = await supabaseAdmin
        .from('round_scores')
        .select('earnings_delta')
        .eq('game_id', gameId)
        .eq('user_id', member.user_id)

      const totalEarnings = (scores ?? []).reduce(
        (sum, s) => sum + ((s as { earnings_delta?: number }).earnings_delta ?? 0),
        0
      )

      await supabaseAdmin
        .from('game_members')
        .update({ earnings: totalEarnings })
        .eq('game_id', gameId)
        .eq('user_id', member.user_id)
    }
  }
}

/**
 * Synkroniserer profiles.points med summen af game_members.earnings for hver bruger.
 */
export async function syncProfilesPoints(): Promise<{ updated: number }> {
  const { data: members } = await supabaseAdmin
    .from('game_members')
    .select('user_id, earnings')

  if (!members?.length) return { updated: 0 }

  const earningsByUser = new Map<string, number>()
  for (const m of members) {
    const uid = m.user_id as string
    const e = (m as { earnings?: number }).earnings ?? 0
    earningsByUser.set(uid, (earningsByUser.get(uid) ?? 0) + e)
  }

  let updated = 0
  for (const [userId, totalEarnings] of earningsByUser) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ points: totalEarnings })
      .eq('id', userId)

    if (!error) updated++
    else console.error(`[syncProfilesPoints] Fejl for user ${userId}:`, error.message)
  }

  return { updated }
}
