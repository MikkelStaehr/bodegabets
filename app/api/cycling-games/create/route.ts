import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

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
  const { name, description, race_selections } = body as {
    name: string
    description: string | null
    race_selections: { race_id: string; block_number: number }[]
  }

  if (!name?.trim() || name.trim().length < 2) {
    return NextResponse.json({ error: 'Spilnavn skal være mindst 2 tegn' }, { status: 400 })
  }
  if (!race_selections?.length) {
    return NextResponse.json({ error: 'Vælg mindst ét løb' }, { status: 400 })
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

  // Opret spilrum med sport = 'cycling'
  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .insert({
      name: name.trim(),
      host_id: user.id,
      invite_code,
      sport: 'cycling',
    })
    .select()
    .single()

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 })
  }

  // Indsæt løb-tilknytninger i cycling_game_races
  const raceRows = race_selections.map((sel) => ({
    game_id: game.id,
    race_id: sel.race_id,
    block_number: sel.block_number,
  }))

  const { error: racesError } = await supabaseAdmin
    .from('cycling_game_races')
    .insert(raceRows)

  if (racesError) {
    return NextResponse.json({ error: racesError.message }, { status: 500 })
  }

  // Tilmeld host som member
  const { error: memberError } = await supabaseAdmin
    .from('game_members')
    .insert({ game_id: game.id, user_id: user.id })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    game_id: game.id,
    invite_code: game.invite_code,
  })
}
