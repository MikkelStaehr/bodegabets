import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { runCyclingPointsForAllGames } from '@/lib/calculateCyclingPoints'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    // Find all finished races
    const { data: finishedRaces } = await supabaseAdmin
      .from('cycling_races')
      .select('id, name')
      .eq('status', 'finished')

    const processed: string[] = []

    for (const race of finishedRaces ?? []) {
      await runCyclingPointsForAllGames(race.id)
      processed.push(race.name)
    }

    return NextResponse.json({
      ok: true,
      processed: processed.length,
      message: `${processed.length} løb beregnet: ${processed.join(', ') || 'ingen'}`,
    })
  } catch (err) {
    console.error('[admin/cycling/calculate-points]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
