import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string; messageId: string }> }

/**
 * DELETE /api/games/[id]/messages/[messageId]
 * Slet en besked. RLS sikrer at kun forfatter eller host kan slette.
 */
export async function DELETE(_req: NextRequest, { params }: Props) {
  const { id, messageId } = await params
  const gameId = Number(id)
  const msgId = Number(messageId)
  if (!gameId || !msgId) return NextResponse.json({ error: 'Ugyldigt id' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  // Hent besked + spil for at validere ejerskab/host
  const { data: msg } = await supabaseAdmin
    .from('gameroom_messages')
    .select('id, user_id, game_id, games:game_id(host_id)')
    .eq('id', msgId)
    .eq('game_id', gameId)
    .maybeSingle()
  if (!msg) return NextResponse.json({ error: 'Besked ikke fundet' }, { status: 404 })

  const game = msg.games as unknown as { host_id: string } | null
  const isAuthor = msg.user_id === user.id
  const isHost = game?.host_id === user.id
  if (!isAuthor && !isHost) {
    return NextResponse.json({ error: 'Ikke tilladt' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('gameroom_messages').delete().eq('id', msgId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
