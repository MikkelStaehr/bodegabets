/**
 * POST /api/admin/sync-result
 * Synkroniserer resultat for én kamp via Bold.dk/fixturedownload.
 * Triggerer liga-sync og buildGameRounds — resultatet propageres fra league_matches til matches.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncLeagueViaBold } from '@/lib/syncLeagueMatches'
import { buildLeagueRounds } from '@/lib/syncLeagueMatches'

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

  // 1. Hent kampen og find liga via round → game
  const { data: match, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, round_id, home_team, away_team, home_score, away_score, status')
    .eq('id', match_id)
    .single()

  if (matchError || !match) {
    return NextResponse.json({ error: 'Kampen blev ikke fundet' }, { status: 404 })
  }

  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('league_id')
    .eq('id', match.round_id)
    .single()

  if (!round?.league_id) {
    return NextResponse.json(
      { error: 'Runden har ingen liga — kan ikke synkronisere resultat' },
      { status: 400 }
    )
  }

  // 2. Sync liga (Bold.dk) — opdaterer league_matches med resultater
  const syncRes = await syncLeagueViaBold(round.league_id)
  if (syncRes.errors.length) {
    console.warn('[sync-result] Sync fejl:', syncRes.errors)
  }

  // 3. Byg runder for ligaen — propagerer scores til matches
  const s = await buildLeagueRounds(round.league_id)
  const matches_updated = s.matches_updated

  // 4. Hent opdateret kamp
  const { data: updated } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', match_id)
    .single()

  return NextResponse.json({
    ok: true,
    match: updated,
    league_synced: syncRes.synced,
    matches_updated,
  })
}
