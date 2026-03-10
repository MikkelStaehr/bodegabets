import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { BET_TYPES, BET_TYPES_LEGACY, type BetType } from '@/lib/betTypes'

const VALID_BET_TYPES: BetType[] = [
  BET_TYPES.BTTS,
  BET_TYPES.OVER_UNDER,
  BET_TYPES.HALVLEG,
  BET_TYPES.MALFORSKEL,
  BET_TYPES_LEGACY.FIRST_SCORER,
  BET_TYPES_LEGACY.TOTAL_GOALS,
  BET_TYPES_LEGACY.YELLOW_CARDS,
  BET_TYPES_LEGACY.RED_CARDS,
  BET_TYPES_LEGACY.HALFTIME,
]

/** POST /api/admin/sidebet-options — tilføj side-bet option til en kamp */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { match_id, bet_type } = body as { match_id: number; bet_type: BetType }

  if (!match_id || !bet_type) {
    return NextResponse.json({ error: 'match_id og bet_type er påkrævet' }, { status: 400 })
  }
  if (!VALID_BET_TYPES.includes(bet_type)) {
    return NextResponse.json({ error: 'Ugyldig bet_type' }, { status: 400 })
  }

  // Tjek om den allerede eksisterer
  const { data: existing } = await supabaseAdmin
    .from('match_sidebet_options')
    .select('id')
    .eq('match_id', match_id)
    .eq('bet_type', bet_type)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Side-bet option eksisterer allerede for denne kamp' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('match_sidebet_options')
    .insert({ match_id, bet_type })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, option: data })
}

/** DELETE /api/admin/sidebet-options — fjern en side-bet option */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id } = body as { id: number }

  if (!id) {
    return NextResponse.json({ error: 'id er påkrævet' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('match_sidebet_options')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
