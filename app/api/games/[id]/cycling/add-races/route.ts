import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { generateCyclingBlocks } from '@/lib/generateCyclingBlocks'

type Props = { params: Promise<{ id: string }> }

/**
 * POST /api/games/[id]/cycling/add-races
 *
 * Tilføjer nye løb til et eksisterende cycling gameroom (kun host).
 * Genaktiverer status til 'active' hvis spilrummet var arkiveret.
 *
 * Body: { race_selections: { race_id: string; block_number: number }[] }
 */
export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameIdStr } = await params
  const gameId = Number(gameIdStr)
  if (isNaN(gameId)) return NextResponse.json({ error: 'Ugyldigt game_id' }, { status: 400 })

  const body = await req.json()
  const { race_selections } = body as {
    race_selections: { race_id: string; block_number: number }[]
  }
  if (!Array.isArray(race_selections) || race_selections.length === 0) {
    return NextResponse.json({ error: 'Vælg mindst ét løb' }, { status: 400 })
  }

  // Verificér: bruger er host af dette spilrum
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, host_id, sport, status')
    .eq('id', gameId)
    .single()

  if (!game) return NextResponse.json({ error: 'Spil ikke fundet' }, { status: 404 })
  if (game.sport !== 'cycling') {
    return NextResponse.json({ error: 'Kun cycling spilrum understøttes' }, { status: 400 })
  }
  if (game.host_id !== user.id) {
    return NextResponse.json({ error: 'Kun spilrums-værten kan tilføje løb' }, { status: 403 })
  }

  // Filtrér valgte løb der allerede er tilknyttet dette spilrum
  const { data: existingLinks } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id')
    .eq('game_id', gameId)

  const alreadyLinked = new Set((existingLinks ?? []).map((l) => l.race_id as string))
  const newSelections = race_selections.filter((s) => !alreadyLinked.has(s.race_id))

  if (newSelections.length === 0) {
    return NextResponse.json({ error: 'Alle valgte løb er allerede tilknyttet' }, { status: 400 })
  }

  // Indsæt nye cycling_game_races
  const raceRows = newSelections.map((sel) => ({
    game_id: gameId,
    race_id: sel.race_id,
    block_number: sel.block_number,
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('cycling_game_races')
    .insert(raceRows)

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Generér blokke for de nye løb (idempotent: skipper løb med eksisterende blok)
  await generateCyclingBlocks(gameId, newSelections)

  // Genaktivér spilrum hvis det var arkiveret + nulstil warning-flag
  if (game.status === 'finished') {
    await supabaseAdmin
      .from('games')
      .update({ status: 'active', archive_warning_sent_at: null })
      .eq('id', gameId)
  } else {
    // Stadig aktivt — bare ryd warning så det ikke triggerer ved næste cron
    await supabaseAdmin
      .from('games')
      .update({ archive_warning_sent_at: null })
      .eq('id', gameId)
  }

  return NextResponse.json({
    ok: true,
    added: newSelections.length,
    reactivated: game.status === 'finished',
  })
}
