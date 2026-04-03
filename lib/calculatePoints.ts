import { supabaseAdmin } from '@/lib/supabase'
import { isBetCorrect } from './betUtils'
import { evaluateAchievements } from '@/lib/evaluateAchievements'

/**
 * V1 — Simpel, idempotent pointberegning.
 *
 * PRINCIP:
 *   Korrekt match_result → stake × consensus odds
 *   Korrekt ekstra bet → stake × consensus odds (fallback 2.0)
 *   Forkert bet → 0 (stake tabt)
 *   earnings_delta = SUM(points_earned) per runde
 *   game_members.earnings = SUM(round_scores.earnings_delta) (absolut, aldrig relativt)
 *
 * Kan køres mange gange — upsert overalt, sætter absolut.
 */

export async function calculateRoundPoints(roundId: number): Promise<void> {
  console.log(`[calculateRoundPoints] START roundId=${roundId}`)

  // 1. Hent finished matches via round_id
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_score, away_score, home_score_ht, away_score_ht, status')
    .eq('round_id', roundId)
    .eq('status', 'finished')

  if (!matches?.length) {
    console.log(`[calculateRoundPoints] Ingen finished matches for runde ${roundId}`)
    return
  }

  console.log(`[calculateRoundPoints] ${matches.length} finished matches: ${matches.map(m => m.id).join(', ')}`)

  const matchIds = matches.map((m) => m.id)

  // Find alle unikke game_ids fra bets for denne rundes kampe
  const { data: betGameRows } = await supabaseAdmin
    .from('bets')
    .select('game_id')
    .in('match_id', matchIds)

  const allGameIds = [...new Set((betGameRows ?? []).map((b) => b.game_id as number))]
  if (allGameIds.length === 0) {
    console.log(`[calculateRoundPoints] Ingen bets fundet for matchIds ${matchIds.join(', ')}`)
    return
  }

  console.log(`[calculateRoundPoints] gameIds med bets: ${allGameIds.join(', ')}`)

  // 2. For hvert game: evaluer bets, beregn earnings, upsert round_scores
  for (const gameId of allGameIds) {
    console.log(`[calculateRoundPoints] === Game ${gameId}, runde ${roundId} ===`)

    // 2a. Evaluer alle bets for alle finished matches i runden
    for (const match of matches) {
      if (match.home_score === null || match.away_score === null) continue

      const { data: bets } = await supabaseAdmin
        .from('bets')
        .select('id, user_id, prediction, stake, bet_type, odds')
        .eq('match_id', match.id)
        .eq('game_id', gameId)

      if (!bets?.length) continue

      console.log(`[calculateRoundPoints] Match ${match.id} (${match.home_score}-${match.away_score}): ${bets.length} bets`)

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
          // Ekstra bets: brug konsensus odds med fallback 2.0
          const odds = (bet as { odds?: number | null }).odds ?? 2.0
          pointsEarned = Math.round(stake * odds)
        }
        const result = correct ? 'win' : 'loss'

        const oddsVal = (bet as { odds?: number | null }).odds ?? null
        console.log(`[calculateRoundPoints]   bet ${bet.id}: user=${(bet.user_id as string).slice(0,8)}, type=${bet.bet_type}, pred=${bet.prediction}, stake=${stake}, odds=${oddsVal}, correct=${correct}, points_earned=${pointsEarned}`)

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
      console.log(`[calculateRoundPoints] Ingen roundBets fundet for game ${gameId} — skipper round_scores`)
      continue
    }

    console.log(`[calculateRoundPoints] ${roundBets.length} bets i runde for game ${gameId}`)

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

      console.log(`[calculateRoundPoints] round_scores UPSERT: user=${userId.slice(0,8)}, round=${roundId}, game=${gameId}, totalEarned=${stats.totalEarned}, earnings_delta=${earningsDelta}`)

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
      } else {
        console.log(`[calculateRoundPoints] round_scores upsert OK for user=${userId.slice(0,8)}`)
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

      console.log(`[calculateRoundPoints] game_members.earnings SET: user=${(member.user_id as string).slice(0,8)}, game=${gameId}, totalEarnings=${totalEarnings} (fra ${(scores ?? []).length} round_scores)`)

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

    console.log(`[calculateRoundPoints] Runde ${roundId} → status=finished`)

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

        console.log(`[calculateRoundPoints] Næste runde ${nextRound.id} → bet_open=true`)

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
            } else {
              console.log(`[calculateRoundPoints] Oprettet ${rows.length} round_members for runde ${nextRound.id}`)
            }
          }
        }
      }
    }
  }

  console.log(`[calculateRoundPoints] DONE roundId=${roundId}`)
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
