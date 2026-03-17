/**
 * POST /api/admin/sync-schedule
 * Synkroniserer kampprogram for en runde via Bold.dk.
 * Triggerer sæson-sync og buildLeagueRounds — kampe hentes fra league_matches.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncSeasonViaBold } from '@/lib/syncLeagueMatches'
import { buildLeagueRounds } from '@/lib/syncLeagueMatches'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { round_id } = body as { round_id: number }

  if (!round_id) {
    return NextResponse.json({ error: 'round_id er påkrævet' }, { status: 400 })
  }

  // 1. Hent runden for at finde season_id
  const { data: round, error: roundError } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id')
    .eq('id', round_id)
    .single()

  if (roundError || !round?.season_id) {
    return NextResponse.json({ error: 'Runden blev ikke fundet eller mangler season_id' }, { status: 404 })
  }

  const seasonId = round.season_id

  // 2. Sync sæson (Bold.dk) — opdaterer league_matches
  const syncRes = await syncSeasonViaBold(seasonId)
  if (syncRes.errors.length) {
    console.warn('[sync-schedule] Sync fejl:', syncRes.errors)
  }

  // 3. Byg runder for sæsonen — tilføjer/opdaterer matches fra league_matches
  const buildRes = await buildLeagueRounds(seasonId)

  return NextResponse.json({
    ok: true,
    synced: syncRes.synced,
    rounds_created: buildRes.rounds_created,
    matches_created: buildRes.matches_created,
    matches_updated: buildRes.matches_updated,
  })
}
