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
      .select('match_id')
      .in('game_id', activeGameIds)

    // Lookup round_ids fra matches med bets
    const betMatchIds = [...new Set((betRounds ?? []).map((b) => b.match_id as number))]

    if (betMatchIds.length > 0) {
      const { data: betMatches } = await supabaseAdmin
        .from('matches')
        .select('round_id')
        .in('id', betMatchIds)

      const roundIds = [...new Set((betMatches ?? []).filter((m) => m.round_id != null).map((m) => m.round_id as number))]

      for (const roundId of roundIds) {
        // Tjek om mindst én kamp i runden er finished
        const { data: matches } = await supabaseAdmin
          .from('matches')
          .select('id, status')
          .eq('round_id', roundId)

        const anyFinished = matches?.some((m) => m.status === 'finished')
        if (!anyFinished) continue

        await calculateRoundPoints(roundId)
        processed++
      }
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
