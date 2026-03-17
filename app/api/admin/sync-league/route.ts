import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncSeasonViaBold } from '@/lib/syncLeagueMatches'
import { buildLeagueRounds } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json() as {
    season_id?: number
    league_id?: number
    leagueId?: number
    rebuild_rounds?: boolean
  }

  const season_id = body.season_id ?? body.league_id ?? body.leagueId

  if (!season_id) {
    return NextResponse.json({ error: 'season_id er påkrævet' }, { status: 400 })
  }

  const syncRes = await syncSeasonViaBold(season_id)

  let rounds_created = 0, matches_created = 0, matches_updated = 0

  if (body.rebuild_rounds) {
    const res = await buildLeagueRounds(season_id)
    rounds_created = res.rounds_created
    matches_created = res.matches_created
    matches_updated = res.matches_updated
  }

  return NextResponse.json({
    ...syncRes,
    rounds_created,
    matches_created,
    matches_updated,
  })
}
