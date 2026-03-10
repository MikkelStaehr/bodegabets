import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

/** GET /api/games/[id]/rounds — returnerer antal runder for spilrummet (via league_id) */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json({ count: 0 })
  }

  const supabase = await createServerSupabaseClient()

  // Hent game for at finde league_id
  const { data: game } = await supabase
    .from('games')
    .select('league_id')
    .eq('id', gameId)
    .single()

  if (!game?.league_id) {
    return NextResponse.json({ count: 0 })
  }

  const { count } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', game.league_id)

  return NextResponse.json({ count: count ?? 0 })
}
