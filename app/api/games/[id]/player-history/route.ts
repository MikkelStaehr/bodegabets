import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { getPlayerHistory } from '@/lib/gameState'

type Props = { params: Promise<{ id: string }> }

// GET /api/games/[id]/player-history?userId=...
// Drill-down: en spillers runde-for-runde historik (bets, point, profit).
// Kun synligt for medlemmer af spilrummet.
export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) return NextResponse.json({ error: 'Ugyldigt game_id' }, { status: 400 })

  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!targetUserId) return NextResponse.json({ error: 'userId er påkrævet' }, { status: 400 })

  // Kun medlemmer må se historik
  const { data: member } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Du er ikke med i dette spil' }, { status: 403 })

  const history = await getPlayerHistory(gameId, targetUserId)
  return NextResponse.json({ history })
}
