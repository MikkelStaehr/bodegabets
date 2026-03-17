import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncSeasonViaBold } from '@/lib/syncLeagueMatches'

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
    return NextResponse.json({ error: 'Season ikke fundet for spilrum' }, { status: 404 })
  }

  const result = await syncSeasonViaBold(gameSeason.season_id)

  return NextResponse.json({
    ok: true,
    game_id,
    game_name: game.name,
    synced: result.synced,
    rounds_created: result.rounds_created,
    matches_created: result.matches_created,
    matches_updated: result.matches_updated,
    errors: result.errors,
  })
}
