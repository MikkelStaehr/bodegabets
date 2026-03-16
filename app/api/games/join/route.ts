import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })
  }

  const body = await req.json()
  const { invite_code } = body as { invite_code: string }

  if (!invite_code?.trim()) {
    return NextResponse.json({ error: 'Invitationskode er påkrævet' }, { status: 400 })
  }

  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .select('id, status')
    .eq('invite_code', invite_code.trim().toUpperCase())
    .maybeSingle()

  if (gameError || !game) {
    return NextResponse.json({ error: 'Ugyldigt invitationskode' }, { status: 404 })
  }

  if (game.status === 'finished') {
    return NextResponse.json({ error: 'Dette spil er afsluttet' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', game.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, game_id: game.id, already_member: true })
  }

  const { error: joinError } = await supabaseAdmin
    .from('game_members')
    .insert({ game_id: game.id, user_id: user.id, points: 1000 })

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, game_id: game.id })
}
