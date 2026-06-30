import { supabaseAdmin } from '@/lib/supabase'
import { isBetCorrect } from './betUtils'
import { BET_TYPES } from './betTypes'
import { evaluateAchievements } from '@/lib/evaluateAchievements'
import { getLosersLuckUserIds, LOSERS_LUCK_BOOST } from '@/lib/losersLuck'

/**
 * stake × odds (match_result fallback 1.0, ekstra-bets 1.5), ×2 hvis 🔥 on-fire-kamp.
 * Losers Luck-boost lægges oveni af kalderen.
 *
 * Knockout-kampe scores som almindelige 1/2-kampe: Bold giver os altid en vinder
 * (straffe-/forlænget-resultatet lægges i scoren), så `isBetCorrect` afgør "hvem
 * går videre" automatisk. Ingen X, ingen admin-afgørelse.
 */
export function computeBasePoints(
  correct: boolean,
  betType: string,
  stake: number,
  odds: number | null | undefined,
  onFire: boolean
): number {
  if (!correct) return 0
  const base = betType === BET_TYPES.MATCH_RESULT ? (odds ?? 1.0) : (odds ?? 1.5)
  let pts = Math.round(stake * base)
  if (onFire) pts = pts * 2
  return pts
}

/**
 * V1 — Simpel, idempotent pointberegning.
 *
 * PRINCIP:
 *   Korrekt match_result → stake × consensus odds
 *   Korrekt ekstra bet → stake × consensus odds (mindre end hoved-bet; fallback 1.5)
 *   Forkert bet → 0 (stake tabt)
 *   earnings_delta = SUM(points_earned) per runde
 *   game_members.earnings = SUM(round_scores.earnings_delta) (absolut, aldrig relativt)
 *
 * Kan køres mange gange — upsert overalt, sætter absolut.
 */

export async function calculateRoundPoints(roundId: number): Promise<void> {
  // 1. Hent finished matches via round_id
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_score, away_score, home_score_ht, away_score_ht, status, is_on_fire, ko_method')
    .eq('round_id', roundId)
    .eq('status', 'finished')

  if (!matches?.length) {
    return
  }

  const matchIds = matches.map((m) => m.id)

  // Find alle unikke game_ids fra bets for denne rundes kampe
  const { data: betGameRows } = await supabaseAdmin
    .from('bets')
    .select('game_id')
    .in('match_id', matchIds)

  const allGameIds = [...new Set((betGameRows ?? []).map((b) => b.game_id as number))]
  if (allGameIds.length === 0) {
    return
  }

  // 🍀 Losers Luck: rundens blok afgør hvilke (nederste) spillere der får boost.
  const { data: roundRow } = await supabaseAdmin
    .from('rounds').select('block_id').eq('id', roundId).single()
  const blockId = (roundRow as { block_id?: number | null } | null)?.block_id ?? null

  // 2. For hvert game: evaluer bets, beregn earnings, upsert round_scores
  for (const gameId of allGameIds) {
    const losersLuck = await getLosersLuckUserIds(gameId, blockId)

    // 2a. Evaluer alle bets for alle finished matches i runden
    for (const match of matches) {
      if (match.home_score === null || match.away_score === null) continue

      const { data: bets } = await supabaseAdmin
        .from('bets')
        .select('id, user_id, prediction, stake, bet_type, odds')
        .eq('match_id', match.id)
        .eq('game_id', gameId)

      if (!bets?.length) continue

      for (const bet of bets) {
        // 'extra_time' (hvordan afgøres kampen?) afgøres af ko_method, ikke scoren:
        // prediction 'reg'/'et'/'pen' vinder hvis = ko_method (null = 'reg').
        const correct = bet.bet_type === 'extra_time'
          ? bet.prediction === ((match as { ko_method?: string | null }).ko_method ?? 'reg')
          : isBetCorrect(
              bet.bet_type,
              bet.prediction,
              match.home_score,
              match.away_score,
              match.home_score_ht,
              match.away_score_ht
            )

        const stake = bet.stake ?? 0
        let pointsEarned = computeBasePoints(
          correct,
          bet.bet_type,
          stake,
          (bet as { odds?: number | null }).odds,
          !!match.is_on_fire
        )
        // 🍀 Losers Luck: +20% på vundne bets for de nederste i sæsonen.
        if (correct && losersLuck.has(bet.user_id as string)) {
          pointsEarned = Math.round(pointsEarned * LOSERS_LUCK_BOOST)
        }
        const result = correct ? 'win' : 'loss'

        const { error: betUpdateError } = await supabaseAdmin
          .from('bets')
          .update({ result, points_earned: pointsEarned })
          .eq('id', bet.id)

        if (betUpdateError) {
          console.error(`[calculateRoundPoints] FEJL ved bet update ${bet.id}:`, betUpdateError)
        }
      }
    }

    // 2b. Beregn earnings_delta per bruger i denne runde
    //     earnings_delta = SUM(points_earned)
    const { data: roundBets } = await supabaseAdmin
      .from('bets')
      .select('user_id, stake, points_earned')
      .eq('game_id', gameId)
      .in('match_id', matchIds)

    if (!roundBets?.length) {
      continue
    }

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
      const earningsDelta = stats.totalEarned

      const { error: upsertError } = await supabaseAdmin.from('round_scores').upsert(
        {
          user_id: userId,
          round_id: roundId,
          game_id: gameId,
          points_earned: stats.totalEarned,
          earnings_delta: earningsDelta,
        },
        { onConflict: 'user_id,round_id,game_id' }
      )

      if (upsertError) {
        console.error(`[calculateRoundPoints] FEJL ved round_scores upsert:`, upsertError)
      }
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

    // Evaluer achievements for alle medlemmer i dette game
    for (const member of members ?? []) {
      try {
        await evaluateAchievements(member.user_id as string, gameId)
      } catch (e) {
        console.error(`[calculateRoundPoints] evaluateAchievements fejl for user ${(member.user_id as string).slice(0, 8)}:`, e)
      }
    }
  }

  // Tjek om alle kampe i runden er finished → sæt rundestatus og åbn næste runde
  const { data: allRoundMatches } = await supabaseAdmin
    .from('matches')
    .select('id, status')
    .eq('round_id', roundId)

  const allFinished =
    (allRoundMatches ?? []).length > 0 &&
    (allRoundMatches ?? []).every((m) => m.status === 'finished')

  if (allFinished) {
    const { data: roundRow } = await supabaseAdmin
      .from('rounds')
      .select('season_id')
      .eq('id', roundId)
      .single()

    await supabaseAdmin
      .from('rounds')
      .update({ status: 'finished' })
      .eq('id', roundId)

    if (roundRow?.season_id) {
      const { data: nextRound } = await supabaseAdmin
        .from('rounds')
        .select('id')
        .eq('season_id', roundRow.season_id)
        .neq('status', 'finished')
        .gt('id', roundId)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextRound) {
        await supabaseAdmin
          .from('rounds')
          .update({ bet_open: true })
          .eq('id', nextRound.id)

        // Opret round_members for alle spillere i spilrum der følger denne sæson
        const { data: gameSeasons } = await supabaseAdmin
          .from('game_seasons')
          .select('game_id')
          .eq('season_id', roundRow.season_id)

        const gsGameIds = (gameSeasons ?? []).map((gs) => gs.game_id as number)
        if (gsGameIds.length > 0) {
          const { data: members } = await supabaseAdmin
            .from('game_members')
            .select('game_id, user_id')
            .in('game_id', gsGameIds)

          if (members?.length) {
            const rows = members.map((m) => ({
              round_id: nextRound.id,
              game_id: m.game_id as number,
              user_id: m.user_id as string,
              betting_balance: 1000,
            }))

            const { error: rmError } = await supabaseAdmin
              .from('round_members')
              .upsert(rows, { onConflict: 'round_id,game_id,user_id', ignoreDuplicates: true })

            if (rmError) {
              console.error(`[calculateRoundPoints] round_members upsert fejl:`, rmError)
            }
          }
        }
      }
    }
  }

}

/**
 * Championship (Bodega Rounds) point-beregning.
 *
 * Forskellen fra calculateRoundPoints:
 * - Kampe hentes via championship_round_matches junction (ikke matches.round_id)
 * - Game_ids hentes fra championship_mode games (ikke game_seasons)
 * - Ingen runde-status management (håndteres af /update-rounds cron)
 */
export async function calculateChampionshipRoundPoints(championshipRoundId: number): Promise<void> {
  // 1. Hent match_ids via junction-tabellen
  const { data: roundMatches } = await supabaseAdmin
    .from('championship_round_matches')
    .select('match_id')
    .eq('championship_round_id', championshipRoundId)

  if (!roundMatches?.length) return

  const matchIds = roundMatches.map((rm) => rm.match_id as number)

  // 2. Hent finished matches
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_score, away_score, home_score_ht, away_score_ht, status')
    .in('id', matchIds)
    .eq('status', 'finished')

  if (!matches?.length) return

  const finishedMatchIds = matches.map((m) => m.id)

  // 3. Find alle game_ids der har bets i denne championship runde
  const { data: betGameRows } = await supabaseAdmin
    .from('bets')
    .select('game_id')
    .eq('round_id', championshipRoundId)
    .in('match_id', finishedMatchIds)

  const allGameIds = [...new Set((betGameRows ?? []).map((b) => b.game_id as number))]
  if (allGameIds.length === 0) return

  // 4. For hvert game: evaluer bets og beregn point
  for (const gameId of allGameIds) {
    // 4a. Evaluer alle bets
    for (const match of matches) {
      if (match.home_score === null || match.away_score === null) continue

      const { data: bets } = await supabaseAdmin
        .from('bets')
        .select('id, user_id, prediction, stake, bet_type, odds')
        .eq('match_id', match.id)
        .eq('game_id', gameId)
        .eq('round_id', championshipRoundId)

      if (!bets?.length) continue

      for (const bet of bets) {
        const correct = isBetCorrect(
          bet.bet_type,
          bet.prediction,
          match.home_score,
          match.away_score,
          match.home_score_ht,
          match.away_score_ht
        )

        const stake = bet.stake ?? 0
        let pointsEarned: number
        if (!correct) {
          pointsEarned = 0
        } else if (bet.bet_type === 'match_result') {
          const odds = (bet as { odds?: number | null }).odds ?? 1.0
          pointsEarned = Math.round(stake * odds)
        } else {
          const odds = (bet as { odds?: number | null }).odds ?? 1.5
          pointsEarned = Math.round(stake * odds)
        }
        const result = correct ? 'win' : 'loss'

        await supabaseAdmin
          .from('bets')
          .update({ result, points_earned: pointsEarned })
          .eq('id', bet.id)
      }
    }

    // 4b. Beregn earnings_delta per bruger
    const { data: roundBets } = await supabaseAdmin
      .from('bets')
      .select('user_id, stake, points_earned')
      .eq('game_id', gameId)
      .eq('round_id', championshipRoundId)
      .in('match_id', finishedMatchIds)

    if (!roundBets?.length) continue

    const userStats = new Map<string, { totalStake: number; totalEarned: number }>()
    for (const b of roundBets) {
      const uid = b.user_id as string
      const entry = userStats.get(uid) ?? { totalStake: 0, totalEarned: 0 }
      entry.totalStake += b.stake ?? 0
      entry.totalEarned += b.points_earned ?? 0
      userStats.set(uid, entry)
    }

    // 4c. Upsert round_scores (round_id = championship_round_id)
    for (const [userId, stats] of userStats) {
      await supabaseAdmin.from('round_scores').upsert(
        {
          user_id: userId,
          round_id: championshipRoundId,
          game_id: gameId,
          points_earned: stats.totalEarned,
          earnings_delta: stats.totalEarned,
        },
        { onConflict: 'user_id,round_id,game_id' }
      )
    }

    // 4d. Opdater game_members.earnings (absolut sum af alle round_scores)
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
