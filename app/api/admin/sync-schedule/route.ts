/**
 * POST /api/admin/sync-schedule
 * Synkroniserer kampprogram for en runde via Bold.dk/fixturedownload.
 * Triggerer liga-sync og buildLeagueRounds — kampe hentes fra league_matches.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncLeagueFixtures } from '@/lib/fixtureDownload'
import { buildLeagueRounds } from '@/lib/syncLeagueMatches'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { round_id } = body as { round_id: number }

  if (!round_id) {
    return NextResponse.json({ error: 'round_id er påkrævet' }, { status: 400 })
  }

  // 1. Hent runden for at finde league_id
  const { data: round, error: roundError } = await supabaseAdmin
    .from('rounds')
    .select('id, league_id')
    .eq('id', round_id)
    .single()

  if (roundError || !round?.league_id) {
    return NextResponse.json({ error: 'Runden blev ikke fundet eller mangler league_id' }, { status: 404 })
  }

  const leagueId = round.league_id

  const { data: league } = await supabaseAdmin
    .from('leagues')
    .select('name')
    .eq('id', leagueId)
    .single()

  const leagueName = league?.name ?? 'Liga'

  // 2. Sync liga (Bold.dk / fixturedownload) — opdaterer league_matches
  const syncRes = await syncLeagueFixtures(leagueId)
  if (syncRes.errors.length) {
    console.warn('[sync-schedule] Sync fejl:', syncRes.errors)
  }

  // 3. Byg runder for ligaen — tilføjer/opdaterer matches fra league_matches
  const buildRes = await buildLeagueRounds(leagueId)

  return NextResponse.json({
    ok: true,
    synced: syncRes.synced,
    league: leagueName,
    rounds_created: buildRes.rounds_created,
    matches_created: buildRes.matches_created,
    matches_updated: buildRes.matches_updated,
  })
}
