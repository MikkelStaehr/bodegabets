import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncCyclingResults } from '@/lib/syncCyclingResults'

/**
 * Backfill stages — nuller results_uploaded_at for valgte stages og kører
 * sync så de re-scrapes med nuværende parser-logik.
 *
 * Brugbar når vi har rettet scraperen og vil have gamle stages opdateret
 * med den nye logik (uden at vente på naturlig cron-cycle, hvor sync
 * skipper stages med results_uploaded_at != NULL).
 *
 * Body kan indeholde:
 *   { race_id?: string }  → kun den race, ellers alle active stage races
 *   { trigger_sync?: bool } → om sync skal køres umiddelbart efter (default true)
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const raceId = typeof body?.race_id === 'string' ? body.race_id : null
    const triggerSync = body?.trigger_sync !== false

    // Find target races
    let racesQuery = supabaseAdmin
      .from('cycling_races')
      .select('id, name')
      .eq('race_type', 'stage_race')
      .in('status', ['active', 'finished'])
    if (raceId) racesQuery = racesQuery.eq('id', raceId)
    const { data: races, error: racesErr } = await racesQuery

    if (racesErr) {
      return NextResponse.json({ error: `Kunne ikke hente races: ${racesErr.message}` }, { status: 500 })
    }
    if (!races || races.length === 0) {
      return NextResponse.json({ ok: true, nulled: 0, message: 'Ingen aktive stage races at backfill\'e' })
    }

    const raceIds = races.map((r) => r.id as string)

    // Tæl stages der vil blive påvirket
    const { count: nulledCount } = await supabaseAdmin
      .from('cycling_stages')
      .select('id', { count: 'exact', head: true })
      .in('race_id', raceIds)
      .not('results_uploaded_at', 'is', null)

    // Nul results_uploaded_at
    const { error: updateErr } = await supabaseAdmin
      .from('cycling_stages')
      .update({ results_uploaded_at: null })
      .in('race_id', raceIds)
      .not('results_uploaded_at', 'is', null)

    if (updateErr) {
      return NextResponse.json({ error: `Nulstilling fejlede: ${updateErr.message}` }, { status: 500 })
    }

    let syncResult: { resultsUpserted: number; stagesProcessed: number; errors: string[] } | null = null
    if (triggerSync) {
      const result = await syncCyclingResults()
      syncResult = {
        resultsUpserted: result.resultsUpserted,
        stagesProcessed: result.stagesProcessed,
        errors: result.errors,
      }
    }

    const raceNames = races.map((r) => r.name).join(', ')
    return NextResponse.json({
      ok: true,
      nulled: nulledCount ?? 0,
      races: races.length,
      raceNames,
      synced: syncResult,
      message: triggerSync
        ? `${nulledCount ?? 0} stages nulstillet og re-synket (${syncResult?.resultsUpserted ?? 0} results)`
        : `${nulledCount ?? 0} stages nulstillet — kør sync manuelt`,
    })
  } catch (err) {
    console.error('[admin/cycling/backfill-stages]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
