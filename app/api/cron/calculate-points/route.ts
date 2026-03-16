import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateRoundPoints, syncProfilesPoints } from '@/lib/calculatePoints'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
      type: 'cron_sync',
      status: processed > 0 ? 'success' : 'info',
      message: `calculate-points: ${processed} rounds processed, ${updated} profiles updated`,
      metadata: {
        rounds_processed: processed,
        profiles_updated: updated,
      }
    })

  return NextResponse.json({ ok: true, processed, profiles_updated: updated })
}
