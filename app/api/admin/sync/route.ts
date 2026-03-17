import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncSeasonViaBold, runLeagueSync } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

type SyncBody =
  | { all: true }
  | { season_id: number }

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as SyncBody

  try {
    if ('all' in body && body.all) {
      const results = await runLeagueSync()
      const total = results.reduce((s, r) => s + r.synced, 0)
      return NextResponse.json({ ok: true, output: `Sync: ${results.length} ligaer, ${total} kampe opdateret`, results })
    }

    if ('season_id' in body) {
      const res = await syncSeasonViaBold(body.season_id)

      return NextResponse.json({
        ok: true,
        output: `${res.synced} kampe synkroniseret, +${res.rounds_created} runder, +${res.matches_created} kampe`,
        synced: res.synced,
        rounds_created: res.rounds_created,
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
