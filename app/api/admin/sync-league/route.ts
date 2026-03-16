import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncSeasonFixtures } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json() as {
    season_id?: number
    seasonId?: number
  }

  const season_id = body.season_id ?? body.seasonId

  if (!season_id) {
    return NextResponse.json({ error: 'season_id er påkrævet' }, { status: 400 })
  }

  const res = await syncSeasonFixtures(season_id)

  return NextResponse.json({
    synced: res.synced,
    rounds_upserted: res.rounds_upserted,
    matches_created: res.matches_created,
    matches_updated: res.matches_updated,
    errors: res.errors,
  })
}
