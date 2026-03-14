import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

/** GET /api/games/[id]/rounds — returnerer runder med match_count for spilrummet.
 * Join-sti: games → game_seasons → seasons → rounds
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json([])
  }

  const supabase = await createServerSupabaseClient()

  // Hent season_ids via game_seasons junction (et spil kan have flere sæsoner)
  const { data: gameSeasons } = await supabase
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map((gs) => gs.season_id).filter((id) => id != null)
  if (seasonIds.length === 0) {
    return NextResponse.json([])
  }

  // Hent runder for disse sæsoner
  const { data: rounds, error: roundsError } = await supabase
    .from('rounds')
    .select('*')
    .in('season_id', seasonIds)
    .order('name', { ascending: true })

  if (roundsError) {
    console.error('[api/games/[id]/rounds]', roundsError.message)
    return NextResponse.json([])
  }

  const roundList = rounds ?? []
  if (roundList.length === 0) {
    return NextResponse.json([])
  }

  // Hent match_count per runde (matches har round_id)
  const roundIds = roundList.map((r) => r.id)
  const { data: matchRows } = await supabaseAdmin
    .from('matches')
    .select('round_id')
    .in('round_id', roundIds)

  const matchCountByRoundId: Record<number, number> = {}
  for (const row of matchRows ?? []) {
    if (row.round_id != null) {
      matchCountByRoundId[row.round_id] = (matchCountByRoundId[row.round_id] ?? 0) + 1
    }
  }

  const roundsWithMatchCount = roundList.map((r) => ({
    ...r,
    match_count: matchCountByRoundId[r.id] ?? 0,
  }))

  return NextResponse.json(roundsWithMatchCount)
}
