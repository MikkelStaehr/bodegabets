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

  // Hent league_id via game_leagues junction table
  const { data: gameLeague } = await supabase
    .from('game_leagues')
    .select('league_id')
    .eq('game_id', gameId)
    .limit(1)
    .single()

  if (!gameLeague?.league_id) {
    return NextResponse.json({ count: 0 })
  }

  const { count } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', gameLeague.league_id)

  return NextResponse.json({ count: count ?? 0 })
}
