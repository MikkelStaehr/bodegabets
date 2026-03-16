import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { runLeagueSync, syncSeasonFixtures } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

type SyncBody =
  | { all: true }
  | { season_id: number }

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as SyncBody

  try {
    // Fuld sync: alle aktive sæsoner via Bold API
    if ('all' in body && body.all) {
      const results = await runLeagueSync()
      const total = results.reduce((s, r) => s + r.synced, 0)
      return NextResponse.json({ ok: true, output: `Sync: ${results.length} sæsoner, ${total} kampe opdateret`, results })
    }

    if ('season_id' in body) {
      const res = await syncSeasonFixtures(body.season_id)
      return NextResponse.json({
        ok: true,
        output: `${res.synced} kampe synkroniseret, +${res.rounds_upserted} runder`,
        synced: res.synced,
        rounds_upserted: res.rounds_upserted,
        matches_created: res.matches_created,
        matches_updated: res.matches_updated,
        errors: res.errors,
      })
    }

    return NextResponse.json({ error: 'Ugyldig body' }, { status: 400 })
  } catch (err) {
    console.error('[admin/sync]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
