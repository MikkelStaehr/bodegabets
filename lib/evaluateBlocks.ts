import { supabaseAdmin } from '@/lib/supabase'

/**
 * Opdaterer status på blocks baseret på runders status.
 *
 * Regler:
 * - block → 'active'   når mindst én runde IKKE er 'upcoming'
 * - block → 'finished' når ALLE runder er 'finished'
 *
 * Idempotent — kan køres mange gange uden bivirkninger.
 */
export async function updateBlockStatuses(seasonId: number): Promise<void> {
  const { data: blocks, error: blocksError } = await supabaseAdmin
    .from('blocks')
    .select('id, status')
    .eq('season_id', seasonId)
    .in('status', ['upcoming', 'active'])

  if (blocksError) {
    console.error(`[updateBlockStatuses] Fejl ved hentning af blocks for sæson ${seasonId}:`, blocksError.message)
    return
  }

  if (!blocks?.length) return

  for (const block of blocks) {
    const { data: rounds, error: roundsError } = await supabaseAdmin
      .from('rounds')
      .select('status')
      .eq('block_id', block.id)

    if (roundsError || !rounds?.length) continue

    const allFinished = rounds.every((r) => r.status === 'finished')
    const anyStarted = rounds.some((r) => r.status !== 'upcoming')

    let newStatus: string | null = null
    if (allFinished && block.status !== 'finished') {
      newStatus = 'finished'
    } else if (anyStarted && block.status === 'upcoming') {
      newStatus = 'active'
    }

    if (newStatus) {
      const { error } = await supabaseAdmin
        .from('blocks')
        .update({ status: newStatus })
        .eq('id', block.id)

      if (error) {
        console.error(`[updateBlockStatuses] Fejl ved opdatering af block ${block.id} → ${newStatus}:`, error.message)
      }
    }
  }
}

/**
 * Finder færdige blocks uden block_winners endnu, beregner vindere
 * og skriver til block_winners + tildeler 'frame_gold' achievement.
 *
 * Vinderkriterium: højest sum af earnings_delta fra round_scores
 * over alle runder i blokken, per bruger per spil.
 *
 * Idempotent — springer over blocks der allerede har block_winners.
 */
export async function evaluateFinishedBlocks(seasonId: number): Promise<void> {
  // Hent færdige blocks for sæsonen
  const { data: finishedBlocks, error: blocksError } = await supabaseAdmin
    .from('blocks')
    .select('id, block_number')
    .eq('season_id', seasonId)
    .eq('status', 'finished')

  if (blocksError) {
    console.error(`[evaluateFinishedBlocks] Fejl ved hentning af blocks for sæson ${seasonId}:`, blocksError.message)
    return
  }

  if (!finishedBlocks?.length) return

  for (const block of finishedBlocks) {
    // Tjek om der allerede er block_winners for denne block
    const { count: existingWinners } = await supabaseAdmin
      .from('block_winners')
      .select('id', { count: 'exact', head: true })
      .eq('block_id', block.id)

    if (existingWinners && existingWinners > 0) continue

    // Hent alle runde-id'er for denne block
    const { data: rounds, error: roundsError } = await supabaseAdmin
      .from('rounds')
      .select('id')
      .eq('block_id', block.id)

    if (roundsError || !rounds?.length) continue

    const roundIds = rounds.map((r) => r.id)

    // Hent alle round_scores for disse runder
    const { data: scores, error: scoresError } = await supabaseAdmin
      .from('round_scores')
      .select('user_id, game_id, earnings_delta')
      .in('round_id', roundIds)

    if (scoresError || !scores?.length) continue

    // Summér earnings_delta per bruger per spil
    const totals = new Map<string, { user_id: string; game_id: number; total: number }>()
    for (const score of scores) {
      const key = `${score.user_id}:${score.game_id}`
      const existing = totals.get(key)
      if (existing) {
        existing.total += score.earnings_delta ?? 0
      } else {
        totals.set(key, {
          user_id: score.user_id,
          game_id: score.game_id,
          total: score.earnings_delta ?? 0,
        })
      }
    }

    // Gruppér per spil og find vinder(e)
    const byGame = new Map<number, Array<{ user_id: string; total: number }>>()
    for (const entry of totals.values()) {
      const list = byGame.get(entry.game_id) ?? []
      list.push({ user_id: entry.user_id, total: entry.total })
      byGame.set(entry.game_id, list)
    }

    for (const [gameId, entries] of byGame.entries()) {
      const maxTotal = Math.max(...entries.map((e) => e.total))
      const winners = entries.filter((e) => e.total === maxTotal)

      for (const winner of winners) {
        // Indsæt block_winner (ON CONFLICT DO NOTHING)
        const { error: winnerError } = await supabaseAdmin
          .from('block_winners')
          .insert({
            block_id: block.id,
            game_id: gameId,
            user_id: winner.user_id,
            points_in_block: maxTotal,
          })

        if (winnerError) {
          // Ignorer konflikter (allerede indsat)
          if (!winnerError.message.includes('duplicate') && !winnerError.code?.includes('23505')) {
            console.error(
              `[evaluateFinishedBlocks] Fejl ved insert af block_winner (block=${block.id}, game=${gameId}, user=${winner.user_id.slice(0, 8)}):`,
              winnerError.message
            )
          }
          continue
        }

        // Tildel frame_gold achievement (game_id=null, globalt)
        const { count: existing } = await supabaseAdmin
          .from('user_achievements')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', winner.user_id)
          .eq('achievement_key', 'frame_gold')
          .is('game_id', null)

        if (!existing || existing === 0) {
          const { error: achError } = await supabaseAdmin
            .from('user_achievements')
            .insert({ user_id: winner.user_id, achievement_key: 'frame_gold', game_id: null })

          if (achError) {
            console.error(
              `[evaluateFinishedBlocks] Fejl ved tildeling af frame_gold til ${winner.user_id.slice(0, 8)}:`,
              achError.message
            )
          }
        }
      }
    }
  }
}
