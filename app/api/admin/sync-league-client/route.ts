/**
 * Client-venlig proxy til sync-league.
 * Bruger requireAdmin (session + is_admin eller Bearer token).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncSeasonViaBold } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { season_id } = await req.json() as { season_id: number }

  if (!season_id) {
    return NextResponse.json({ error: 'season_id er påkrævet' }, { status: 400 })
  }

  const res = await syncSeasonViaBold(season_id)

  return NextResponse.json({
    synced: res.synced,
    rounds_created: res.rounds_created,
    matches_created: res.matches_created,
    matches_updated: res.matches_updated,
    errors: res.errors,
  })
}
