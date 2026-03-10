import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

/** GET /api/games/[id]/rounds — returnerer antal runder for spilrummet */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json({ count: 0 })
  }

  const supabase = await createServerSupabaseClient()
  const { count } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)

  return NextResponse.json({ count: count ?? 0 })
}
