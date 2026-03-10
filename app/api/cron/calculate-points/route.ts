import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateRoundPoints, syncProfilesPoints } from '@/lib/calculatePoints'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find alle runder der er finished men endnu ikke har fået points beregnet
  const { data: finishedRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, game_id')
    .eq('status', 'finished')

  let processed = 0

  if (finishedRounds?.length) {
    for (const round of finishedRounds) {
      // Tjek om alle kampe er finished
      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('id, status')
        .eq('round_id', round.id)

      const allFinished = matches?.every((m) => m.status === 'finished')
      if (!allFinished) continue

      await calculateRoundPoints(round.id)
      processed++
    }
  }

  // Synkroniser profiles.points med sum af game_members.points for alle brugere
  const { updated } = await syncProfilesPoints()

  return NextResponse.json({ ok: true, processed, profiles_updated: updated })
}
