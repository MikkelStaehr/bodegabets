import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { getGameLeaderboard } from '@/lib/gameState'

type Props = { params: Promise<{ id: string }> }

/**
 * Legacy endpoint — bruger nu den samme helper som /state.
 * Kan fjernes i fase 4 når alle klienter er migreret til useGameState.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id: gameId } = await params
  const numericGameId = Number(gameId)

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', numericGameId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  const result = await getGameLeaderboard(numericGameId)
  return NextResponse.json(result)
}
