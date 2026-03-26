import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { generateBlocksForSeason } from '@/lib/generateBlocks'

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
  const { name, season_id, cup_season_ids } = body as {
    name: string
    season_id: number
    cup_season_ids?: number[]
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 })
  }
  if (!season_id) {
    return NextResponse.json({ error: 'Turnering er påkrævet' }, { status: 400 })
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
      host_id: user.id,
      invite_code,
    })
    .select()
    .single()

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 })
  }

  // Link game to all selected seasons via junction table
  const allSeasonIds = [season_id, ...(cup_season_ids ?? [])]
  for (const season_id of allSeasonIds) {
    const { error: linkError } = await supabaseAdmin
      .from('game_seasons')
      .insert({ game_id: game.id, season_id })

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }
  }

  // Auto-generer blocks for alle tilknyttede sæsoner (idempotent)
  for (const sid of allSeasonIds) {
    await generateBlocksForSeason(sid)
  }

  // Tilmeld host som member
  const { error: memberError } = await supabaseAdmin
    .from('game_members')
    .insert({ game_id: game.id, user_id: user.id })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Tildel 1000 credits til host for alle åbne runder på tværs af alle sæsoner
  const { data: openRounds } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .in('season_id', allSeasonIds)
    .eq('bet_open', true)
  for (const round of openRounds ?? []) {
    await supabaseAdmin
      .from('round_members')
      .upsert(
        { user_id: user.id, round_id: round.id, game_id: game.id, betting_balance: 1000 },
        { onConflict: 'user_id,round_id,game_id' }
      )
  }

  // Tjek at der eksisterer runder for den primære sæson
  const { count: roundCount } = await supabaseAdmin
    .from('rounds')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season_id)

  return NextResponse.json({
    ok: true,
    game_id: game.id,
    invite_code: game.invite_code,
    seasons: allSeasonIds,
    warning: (roundCount ?? 0) === 0
      ? 'Ingen runder fundet for den primære liga. Synk liga via admin → Liga Hub først.'
      : null,
  })
}
