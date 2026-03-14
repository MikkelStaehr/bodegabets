import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  // Tjek at spillet eksisterer og brugeren er medlem
  const { data: member } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Du er ikke medlem af dette spilrum' }, { status: 404 })

  // Host må ikke forlade sit eget spilrum
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('host_id')
    .eq('id', gameId)
    .single()

  if (game?.host_id === user.id) {
    return NextResponse.json({ error: 'Spillets vært kan ikke forlade spilrummet' }, { status: 403 })
  }

  // Tæl øvrige medlemmer (ekskl. brugeren selv)
  const { count } = await supabaseAdmin
    .from('game_members')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .neq('user_id', user.id)

  const isLastMember = count === 0

  // Slet brugerens data
  await supabaseAdmin.from('bets').delete().eq('game_id', gameId).eq('user_id', user.id)
  await supabaseAdmin.from('round_scores').delete().eq('game_id', gameId).eq('user_id', user.id)
  await supabaseAdmin.from('game_members').delete().eq('game_id', gameId).eq('user_id', user.id)

  if (isLastMember) {
    // Slet alt resterende data for spilrummet
    await supabaseAdmin.from('bets').delete().eq('game_id', gameId)
    await supabaseAdmin.from('round_scores').delete().eq('game_id', gameId)
    await supabaseAdmin.from('game_seasons').delete().eq('game_id', gameId)
    await supabaseAdmin.from('games').delete().eq('id', gameId)
    return NextResponse.json({ ok: true, deleted: true })
  }

  return NextResponse.json({ ok: true, deleted: false })
}
