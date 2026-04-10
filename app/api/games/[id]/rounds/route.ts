import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

/** GET /api/games/[id]/rounds — returnerer antal runder for spilrummet (via season_id) */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json({ count: 0 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ count: 0 })

  // Hent season_id via game_seasons junction table
  const { data: gameSeason } = await supabase
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)
    .limit(1)
    .single()

  if (!gameSeason?.season_id) {
    return NextResponse.json({ count: 0 })
  }

  const { count } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', gameSeason.season_id)

  return NextResponse.json({ count: count ?? 0 })
}
