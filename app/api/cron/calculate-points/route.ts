/**
 * MANUEL FALLBACK — køres ikke automatisk.
 * Points beregnes event-drevet fra syncMatchScores.ts når en kamp skifter til 'finished'.
 * Kan trigges manuelt via POST /api/admin/run-cron { cron: 'calculate-points' }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateRoundPoints, syncProfilesPoints } from '@/lib/calculatePoints'
import { requireCronAuth } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers.get('authorization'))
  if (authError) return authError

  // Find aktive games
  const { data: activeGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('status', 'active')

  const activeGameIds = (activeGames ?? []).map((g) => g.id as number)

  let processed = 0

  if (activeGameIds.length > 0) {
    // Tidligt filter: find kun runder der faktisk har bets i aktive games
    const { data: betRounds } = await supabaseAdmin
      .from('bets')
      .select('round_id')
      .in('game_id', activeGameIds)

    const roundIds = [...new Set((betRounds ?? []).map((b) => b.round_id as number))]

    for (const roundId of roundIds) {
      // Tjek om alle kampe i runden er finished
      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('id, status')
        .eq('round_id', roundId)

      const allFinished = matches?.every((m) => m.status === 'finished')
      if (!allFinished) continue

      await calculateRoundPoints(roundId)
      processed++
    }
  }

  // Synkroniser profiles.points med sum af game_members.points for alle brugere
  const { updated } = await syncProfilesPoints()

  await supabaseAdmin
    .from('admin_logs')
    .insert({
      type: 'calculate_points',
      status: processed > 0 ? 'success' : 'info',
      message: `calculate-points: ${processed} rounds processed, ${updated} profiles updated`,
      metadata: {
        rounds_processed: processed,
        profiles_updated: updated,
      }
    })

  return NextResponse.json({ ok: true, processed, profiles_updated: updated })
}
