import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncSeasonFixtures } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { game_id } = await req.json() as { game_id: number }
  if (!game_id) return NextResponse.json({ error: 'game_id mangler' }, { status: 400 })

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name')
    .eq('id', game_id)
    .single()

  if (!game) {
    return NextResponse.json({ error: 'Spilrum ikke fundet' }, { status: 404 })
  }

  // Hent season_id via game_seasons junction table
  const { data: gameSeason } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', game_id)
    .limit(1)
    .single()

  if (!gameSeason?.season_id) {
    return NextResponse.json({ error: 'Sæson ikke fundet for spilrum' }, { status: 404 })
  }

  const result = await syncSeasonFixtures(gameSeason.season_id)

  // Hvis ingen matches blev oprettet, hent diagnostic
  let diagnostic: { matches_count?: number; rounds_count?: number } | null = null
  if (result.matches_created === 0 && result.matches_updated === 0) {
    const [mRes, rRes] = await Promise.all([
      supabaseAdmin.from('matches').select('*', { count: 'exact', head: true }).eq('season_id', gameSeason.season_id),
      supabaseAdmin.from('rounds').select('*', { count: 'exact', head: true }).eq('season_id', gameSeason.season_id),
    ])
    diagnostic = {
      matches_count: mRes.count ?? 0,
      rounds_count: rRes.count ?? 0,
    }
  }

  return NextResponse.json({
    ok: true,
    game_id,
    game_name: game.name,
    synced: result.synced,
    matches_created: result.matches_created,
    matches_updated: result.matches_updated,
    rounds_upserted: result.rounds_upserted,
    errors: result.errors,
    diagnostic: diagnostic ?? undefined,
  })
}
