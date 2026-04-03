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

  // Hent game
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('id', gameId)
    .single()

  if (!game) {
    return NextResponse.json({ error: 'Spil ikke fundet' }, { status: 404 })
  }

  // Slet i korrekt rækkefølge pga. manglende CASCADE på foreign keys
  try {
    await supabaseAdmin.from('game_seasons').delete().eq('game_id', gameId)
    await supabaseAdmin.from('round_members').delete().eq('game_id', gameId)
    await supabaseAdmin.from('round_scores').delete().eq('game_id', gameId)
    await supabaseAdmin.from('block_winners').delete().eq('game_id', gameId)
    await supabaseAdmin.from('user_achievements').delete().eq('game_id', gameId)
    await supabaseAdmin.from('bets').delete().eq('game_id', gameId)
    await supabaseAdmin.from('game_members').delete().eq('game_id', gameId)

    const { error } = await supabaseAdmin.from('games').delete().eq('id', gameId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ukendt fejl ved sletning' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, deleted_game_id: gameId })
}
