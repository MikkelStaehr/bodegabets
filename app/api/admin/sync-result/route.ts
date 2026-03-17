/**
 * POST /api/admin/sync-result
 * Synkroniserer resultat for én kamp via Bold.dk.
 * Triggerer sæson-sync — resultater skrives direkte til matches.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncSeasonViaBold } from '@/lib/syncLeagueMatches'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.ADMIN_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { match_id } = body as { match_id: number }

  if (!match_id) {
    return NextResponse.json({ error: 'match_id er påkrævet' }, { status: 400 })
  }

  // 1. Hent kampen og find sæson via season_id
  const { data: match, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, season_id, status')
    .eq('id', match_id)
    .single()

  if (matchError || !match) {
    return NextResponse.json({ error: 'Kampen blev ikke fundet' }, { status: 404 })
  }

  if (!match.season_id) {
    return NextResponse.json(
      { error: 'Kampen har ingen season_id — kan ikke synkronisere resultat' },
      { status: 400 }
    )
  }

  // 2. Sync sæson (Bold.dk) — opdaterer matches direkte
  const syncRes = await syncSeasonViaBold(match.season_id)

  // 3. Hent opdateret kamp
  const { data: updated } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', match_id)
    .single()

  return NextResponse.json({
    ok: true,
    match: updated,
    season_synced: syncRes.synced,
    matches_updated: syncRes.matches_updated,
  })
}
