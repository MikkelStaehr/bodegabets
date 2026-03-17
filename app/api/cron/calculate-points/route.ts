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

    // Lookup match → round via matches table
    const betMatchIds = [...new Set((betRounds ?? []).map((b) => b.match_id as number))]

    if (betMatchIds.length > 0) {
      const { data: betMatches } = await supabaseAdmin
        .from('matches')
        .select('season_id, round_name')
        .in('id', betMatchIds)

      const roundKeys = [...new Set((betMatches ?? []).map((m) => `${m.season_id}::${m.round_name}`))]

      // Find matching rounds
      const { data: allRounds } = await supabaseAdmin
        .from('rounds')
        .select('id, season_id, name')

      for (const round of allRounds ?? []) {
        const key = `${round.season_id}::${round.name}`
        if (!roundKeys.includes(key)) continue

        // Tjek om mindst én kamp i runden er finished
        const { data: matches } = await supabaseAdmin
          .from('matches')
          .select('id, status')
          .eq('season_id', round.season_id)
          .eq('round_name', round.name)

        const anyFinished = matches?.some((m) => m.status === 'finished')
        if (!anyFinished) continue

        await calculateRoundPoints(round.id)
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
