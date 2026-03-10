import { NextRequest, NextResponse } from 'next/server'
import { runLeagueSync } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runLeagueSync()

    const totals = results.reduce(
      (acc, r) => ({
        synced:          acc.synced          + r.synced,
        rounds_created:  acc.rounds_created  + r.rounds_created,
        matches_created: acc.matches_created + r.matches_created,
        matches_updated: acc.matches_updated + r.matches_updated,
      }),
      { synced: 0, rounds_created: 0, matches_created: 0, matches_updated: 0 }
    )

    return NextResponse.json({
      ok: true,
      synced_at:      new Date().toISOString(),
      leagues_synced: results.length,
      ...totals,
      details:        results,
    })
  } catch (err) {
    console.error('[cron/sync-fixtures]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
