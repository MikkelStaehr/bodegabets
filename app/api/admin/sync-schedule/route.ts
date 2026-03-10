/**
 * POST /api/admin/sync-schedule
 * Synkroniserer kampprogram for en runde via Bold.dk/fixturedownload.
 * Triggerer liga-sync og buildGameRounds — kampe hentes fra league_matches.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncLeagueFixtures } from '@/lib/fixtureDownload'
import { buildGameRounds } from '@/lib/syncLeagueMatches'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { round_id, game_id } = body as { round_id: number; game_id: number }

  if (!round_id || !game_id) {
    return NextResponse.json({ error: 'round_id og game_id er påkrævet' }, { status: 400 })
  }

  // 1. Hent runden og spillet for at finde league_id
  const { data: round, error: roundError } = await supabaseAdmin
    .from('rounds')
    .select('id, game_id')
    .eq('id', round_id)
    .eq('game_id', game_id)
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: 'Runden blev ikke fundet' }, { status: 404 })
  }

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('league_id')
    .eq('id', game_id)
    .single()

  if (!game?.league_id) {
    return NextResponse.json(
      { error: 'Spillet har ingen liga tilknyttet — sæt league_id på games' },
      { status: 400 }
    )
  }

  const leagueId = game.league_id

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

  // 3. Byg runder for spillet — tilføjer/opdaterer matches fra league_matches
  const buildRes = await buildGameRounds(game_id, leagueId)

  return NextResponse.json({
    ok: true,
    synced: syncRes.synced,
    league: leagueName,
    rounds_created: buildRes.rounds_created,
    matches_created: buildRes.matches_created,
    matches_updated: buildRes.matches_updated,
  })
}
