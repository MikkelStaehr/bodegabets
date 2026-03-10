import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateRoundPoints, syncProfilesPoints } from '@/lib/calculatePoints'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find alle runder der er lukkede/aktive men ikke finished
  // (closed = betting lukket, active = deadline passeret — begge kan have færdige kampe)
  const { data: closedRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, game_id')
    .in('status', ['closed', 'active'])

  let processed = 0

  if (closedRounds?.length) {
    for (const round of closedRounds) {
      // Tjek om alle kampe er finished
      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('id, status')
        .eq('round_id', round.id)

      const allFinished = matches?.every((m) => m.status === 'finished')
      if (!allFinished) continue

      await calculateRoundPoints(round.id)

      // Markér runden som finished (calculateRoundPoints gør det også, men sikrer konsistens)
      await supabaseAdmin
        .from('rounds')
        .update({ status: 'finished' })
        .eq('id', round.id)

      processed++
    }
  }

  // Synkroniser profiles.points med sum af game_members.points for alle brugere
  const { updated } = await syncProfilesPoints()

  return NextResponse.json({ ok: true, processed, profiles_updated: updated })
}
