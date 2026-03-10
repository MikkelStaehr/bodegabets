import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 30

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })
  }

  const body = await req.json()
  const { name, description, league_id } = body as {
    name: string
    description?: string
    league_id: number
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 })
  }
  if (!league_id) {
    return NextResponse.json({ error: 'Liga er påkrævet' }, { status: 400 })
  }

  // Sikr at brugerens profil eksisterer (FK games.host_id → profiles.id)
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!existingProfile) {
    const username = user.user_metadata?.username
      ?? user.email?.split('@')[0]
      ?? `spiller_${user.id.slice(0, 6)}`
    await supabaseAdmin
      .from('profiles')
      .insert({ id: user.id, username, points: 0 })
  }

  // Generer unik invite_code
  let invite_code = generateInviteCode()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('invite_code', invite_code)
      .maybeSingle()
    if (!data) break
    invite_code = generateInviteCode()
    attempts++
  }

  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .insert({
      name: name.trim(),
      description: description ?? null,
      host_id: user.id,
      invite_code,
      league_id,
    })
    .select()
    .single()

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 })
  }

  // Tilmeld host som member med 1000 startpoint
  const { error: memberError } = await supabaseAdmin
    .from('game_members')
    .insert({ game_id: game.id, user_id: user.id, points: 1000 })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Tjek at der eksisterer runder for denne liga
  const { count: roundCount } = await supabaseAdmin
    .from('rounds')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', league_id)

  return NextResponse.json({
    ok: true,
    game_id: game.id,
    invite_code: game.invite_code,
    warning: (roundCount ?? 0) === 0
      ? 'Ingen runder fundet for denne liga. Synk liga via admin → Liga Hub først.'
      : null,
  })
}
