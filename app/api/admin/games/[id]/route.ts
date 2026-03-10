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

  // Hent game for league_id
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, league_id')
    .eq('id', gameId)
    .single()

  if (!game) {
    return NextResponse.json({ error: 'Spil ikke fundet' }, { status: 404 })
  }

  // Rounds tilhører nu en liga, ikke et spil. Slet kun game-specifik data.
  // Hent round_ids via league_id for at finde match_ids til bets-sletning
  const roundIds = game.league_id
    ? await supabaseAdmin
        .from('rounds')
        .select('id')
        .eq('league_id', game.league_id)
        .then(({ data }) => (data ?? []).map((r: { id: number }) => r.id))
    : []

  const matchIds = roundIds.length
    ? await supabaseAdmin
        .from('matches')
        .select('id')
        .in('round_id', roundIds)
        .then(({ data }) => (data ?? []).map((m: { id: number }) => m.id))
    : []

  // Slet bets for dette game (bets har game_id)
  if (matchIds.length) {
    await supabaseAdmin.from('bets').delete().eq('game_id', gameId).in('match_id', matchIds)
  }

  // Slet round_scores for dette game
  if (roundIds.length) {
    await supabaseAdmin.from('round_scores').delete().eq('game_id', gameId).in('round_id', roundIds)
  }

  // Slet game_members og selve gamet
  await supabaseAdmin.from('game_members').delete().eq('game_id', gameId)
  const { error } = await supabaseAdmin.from('games').delete().eq('id', gameId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted_game_id: gameId })
}
