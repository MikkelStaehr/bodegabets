/**
 * MANUEL FALLBACK — køres ikke automatisk.
 * Railway (railway/index.ts) er den primære cron-kilde via node-cron (hvert 30. min).
 * Kan trigges manuelt via POST /api/admin/run-cron { cron: 'sync-fixtures' }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runLeagueSync, syncBoldFixtures } from '@/lib/syncLeagueMatches'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cronAuth'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const authHeader = req.headers.get('authorization') ?? `Bearer ${url.searchParams.get('secret')}`
  const authError = requireCronAuth(authHeader)
  if (authError) return authError

  const leagueId = req.nextUrl.searchParams.get('league_id')
  const forceBold = req.nextUrl.searchParams.get('force_bold') === '1'

  try {
    let results: Awaited<ReturnType<typeof runLeagueSync>>
    if (leagueId && forceBold) {
      const id = parseInt(leagueId, 10)
      const { data: league } = await supabaseAdmin
        .from('leagues')
        .select('id, name, bold_phase_id')
        .eq('id', id)
        .single()
      if (!league?.bold_phase_id) {
        return NextResponse.json({ error: `Liga ${id} har ikke bold_phase_id` }, { status: 400 })
      }
      const res = await syncBoldFixtures(id, league.bold_phase_id)
      results = [{
        league_id: id,
        synced: res.synced,
        rounds_created: 0,
        matches_created: 0,
        matches_updated: 0,
        errors: res.errors,
      }]
    } else {
      results = await runLeagueSync()
    }

    const totals = results.reduce(
      (acc, r) => ({
        synced:          acc.synced          + r.synced,
        rounds_created:  acc.rounds_created  + r.rounds_created,
        matches_created: acc.matches_created + r.matches_created,
        matches_updated: acc.matches_updated + r.matches_updated,
      }),
      { synced: 0, rounds_created: 0, matches_created: 0, matches_updated: 0 }
    )

    await supabaseAdmin
      .from('admin_logs')
      .insert({
        type: 'sync_fixtures',
        status: totals.synced > 0 ? 'success' : 'info',
        message: `sync-fixtures: ${results.length} leagues, ${totals.matches_created} created, ${totals.matches_updated} updated`,
        metadata: {
          leagues_synced: results.length,
          ...totals,
        }
      })

    return NextResponse.json({
      ok: true,
      synced_at:      new Date().toISOString(),
      leagues_synced: results.length,
      ...totals,
      details:        results,
    })
  } catch (err) {
    console.error('[cron/sync-fixtures]', err)
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        type: 'sync_fixtures',
        status: 'error',
        message: `sync-fixtures failed: ${String(err)}`,
      })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
