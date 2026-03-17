/**
 * POST /api/admin/sync-schedule
 * Synkroniserer kampprogram for en runde via Bold.dk.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncSeasonViaBold } from '@/lib/syncLeagueMatches'

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

  // 2. Sync sæson (Bold.dk) — opdaterer matches + rounds direkte
  const res = await syncSeasonViaBold(round.season_id)

  return NextResponse.json({
    ok: true,
    synced: res.synced,
    rounds_created: res.rounds_created,
    matches_created: res.matches_created,
    matches_updated: res.matches_updated,
  })
}
