import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json({ error: 'Ugyldigt game ID' }, { status: 400 })
  }

  // Slet i rækkefølge pga. FK constraints:
  // bets → match_sidebet_options → matches → rounds → round_scores → game_members → games

  const roundIds = await supabaseAdmin
    .from('rounds')
    .select('id')
    .eq('game_id', gameId)
    .then(({ data }) => (data ?? []).map((r: { id: number }) => r.id))

  const matchIds = roundIds.length
    ? await supabaseAdmin
        .from('matches')
        .select('id')
        .in('round_id', roundIds)
        .then(({ data }) => (data ?? []).map((m: { id: number }) => m.id))
    : []

  if (matchIds.length) {
    await supabaseAdmin.from('bets').delete().in('match_id', matchIds)
    await supabaseAdmin.from('match_sidebet_options').delete().in('match_id', matchIds)
    await supabaseAdmin.from('matches').delete().in('id', matchIds)
  }

  if (roundIds.length) {
    await supabaseAdmin.from('round_scores').delete().in('round_id', roundIds)
    await supabaseAdmin.from('rounds').delete().in('id', roundIds)
  }

  await supabaseAdmin.from('game_members').delete().eq('game_id', gameId)
  const { error } = await supabaseAdmin.from('games').delete().eq('id', gameId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted_game_id: gameId })
}
