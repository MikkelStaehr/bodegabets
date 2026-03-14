/**
 * MANUEL FALLBACK — køres ikke automatisk.
 * Railway (railway/index.ts) er den primære cron-kilde via node-cron (dagligt).
 * Kan trigges manuelt via POST /api/admin/run-cron { cron: 'sync-fixtures' }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runLeagueSync } from '@/lib/syncLeagueMatches'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cronAuth'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers.get('authorization'))
  if (authError) return authError

  try {
    const results = await runLeagueSync()

    const totals = results.reduce(
      (acc, r) => ({
        synced: acc.synced + r.synced,
        matches_created: acc.matches_created + r.matches_created,
        matches_updated: acc.matches_updated + r.matches_updated,
        rounds_upserted: acc.rounds_upserted + r.rounds_upserted,
      }),
      { synced: 0, matches_created: 0, matches_updated: 0, rounds_upserted: 0 }
    )

    await supabaseAdmin.from('admin_logs').insert({
      type: 'sync_fixtures',
      status: totals.synced > 0 ? 'success' : 'info',
      message: `sync-fixtures: ${results.length} sæsoner, ${totals.matches_created} matches oprettet, ${totals.matches_updated} opdateret, ${totals.rounds_upserted} runder`,
      metadata: {
        seasons_synced: results.length,
        ...totals,
      },
    })

    return NextResponse.json({
      ok: true,
      synced_at: new Date().toISOString(),
      seasons_synced: results.length,
      ...totals,
      details: results,
    })
  } catch (err) {
    console.error('[cron/sync-fixtures]', err)
    await supabaseAdmin.from('admin_logs').insert({
      type: 'sync_fixtures',
      status: 'error',
      message: `sync-fixtures failed: ${String(err)}`,
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
