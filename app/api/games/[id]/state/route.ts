import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { getGameState } from '@/lib/gameState'

type Props = { params: Promise<{ id: string }> }

/**
 * GET /api/games/[id]/state
 *
 * Samlet live-state for et fodbold gameroom. Erstatter /live-matches
 * og /leaderboard for klienter der har brug for alt i én request.
 * Polles af useGameState-hook i gamerummet.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json({ error: 'Ugyldigt game_id' }, { status: 400 })
  }

  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const state = await getGameState(gameId, user.id)
  if (!state) return NextResponse.json({ error: 'Spil ikke fundet' }, { status: 404 })

  return NextResponse.json(state)
}
