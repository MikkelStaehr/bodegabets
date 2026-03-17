import { NextRequest, NextResponse } from 'next/server'
import { runLeagueSync, syncBoldFixtures } from '@/lib/syncLeagueMatches'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const auth = req.headers.get('authorization')
    ?? `Bearer ${url.searchParams.get('secret')}`
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const seasonId = req.nextUrl.searchParams.get('season_id')
  const forceBold = req.nextUrl.searchParams.get('force_bold') === '1'

  try {
    let results: Awaited<ReturnType<typeof runLeagueSync>>
    if (seasonId && forceBold) {
      const id = parseInt(seasonId, 10)
      const { data: season } = await supabaseAdmin
        .from('seasons')
        .select('id, bold_phase_id')
        .eq('id', id)
        .single()
      if (!season?.bold_phase_id) {
        return NextResponse.json({ error: `Sæson ${id} har ikke bold_phase_id` }, { status: 400 })
      }
      const res = await syncBoldFixtures(id, season.bold_phase_id)
      results = [{
        season_id: id,
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
        type: 'cron_sync',
        status: totals.synced > 0 ? 'success' : 'info',
        message: `sync-fixtures: ${results.length} seasons, ${totals.matches_created} created, ${totals.matches_updated} updated`,
        metadata: {
          seasons_synced: results.length,
          ...totals,
        }
      })

    return NextResponse.json({
      ok: true,
      synced_at:       new Date().toISOString(),
      seasons_synced:  results.length,
      ...totals,
      details:         results,
    })
  } catch (err) {
    console.error('[cron/sync-fixtures]', err)
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        type: 'cron_sync',
        status: 'error',
        message: `sync-fixtures failed: ${String(err)}`,
      })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
