import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncLeagueViaBold } from '@/lib/syncLeagueMatches'
import { buildLeagueRounds } from '@/lib/syncLeagueMatches'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json() as {
    league_id?: number
    leagueId?: number
    rebuild_rounds?: boolean
  }

  const league_id = body.league_id ?? body.leagueId

  if (!league_id) {
    return NextResponse.json({ error: 'league_id er påkrævet' }, { status: 400 })
  }

  const syncRes = await syncLeagueViaBold(league_id)

  let rounds_created = 0, matches_created = 0, matches_updated = 0

  if (body.rebuild_rounds) {
    const res = await buildLeagueRounds(league_id)
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
