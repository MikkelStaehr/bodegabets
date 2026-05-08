import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  runCyclingPointsForStage,
  runCyclingPointsForAllGames,
} from '@/lib/calculateCyclingPoints'

/**
 * Beregner cycling points.
 *
 * Body kan indeholde:
 *   { stage_id: string }  → kun den ene etape (bruges af sync_results-hook)
 *   {}                    → alle stages med results_uploaded_at + alle finished races
 *                          (bagudkompatibel default)
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const stageId = typeof body?.stage_id === 'string' ? body.stage_id : null

    // Per-stage trigger — bruges af sync_results.py hook
    if (stageId) {
      await runCyclingPointsForStage(stageId)
      return NextResponse.json({
        ok: true,
        processed: 1,
        message: `Stage ${stageId} beregnet`,
      })
    }

    // Bulk-trigger: alle stages med uploaded results (active + finished races)
    const { data: stages } = await supabaseAdmin
      .from('cycling_stages')
      .select('id, stage_number, race_id, cycling_races!inner(name, status)')
      .not('results_uploaded_at', 'is', null)
      .order('stage_number')

    const processed: string[] = []
    const stageRows = ((stages ?? []) as unknown) as Array<{
      id: string
      stage_number: number
      race_id: string
      cycling_races: { name: string; status: string }
    }>

    // Group by race for cleaner logging
    const raceNames = new Map<string, string>()
    for (const s of stageRows) {
      raceNames.set(s.race_id, s.cycling_races.name)
      await runCyclingPointsForStage(s.id)
    }

    // Gamle finished one-day races har måske resultater uden stage-niveau
    // results_uploaded_at — kør den oprindelige bulk-fallback for dem
    const { data: finishedRaces } = await supabaseAdmin
      .from('cycling_races')
      .select('id, name')
      .eq('status', 'finished')

    for (const race of finishedRaces ?? []) {
      if (!raceNames.has(race.id)) {
        await runCyclingPointsForAllGames(race.id)
        processed.push(race.name)
      }
    }
    raceNames.forEach((name) => processed.push(name))

    return NextResponse.json({
      ok: true,
      processed: processed.length,
      stages: stageRows.length,
      message: `${stageRows.length} stages + ${processed.length - raceNames.size} bulk-races: ${processed.join(', ') || 'ingen'}`,
    })
  } catch (err) {
    console.error('[admin/cycling/calculate-points]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
