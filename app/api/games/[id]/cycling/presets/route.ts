import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

const MAX_PRESETS_PER_SQUAD = 5
const VALID_ROLES = new Set([
  'leader', 'lieutenant', 'grimpeur', 'sprinter',
  'domestique', 'equipier_0', 'equipier_1', 'equipier_2', 'joker',
])

type PresetBody = {
  squad_id?: string
  slot_index?: number
  name?: string
  slots?: Record<string, string | null>
}

/**
 * Validér + saniter slots-payload. Fjerner ukendte rolle-nøgler, sikrer at
 * værdier enten er et uuid-lignende rytter-id eller null. Verificerer at alle
 * rytter-id'er hører til den givne squad (efter transfers anvendt) — preset
 * kan ikke pege på en rytter brugeren ikke ejer.
 */
async function sanitizeSlots(squadId: string, raw: Record<string, string | null>) {
  const cleaned: Record<string, string | null> = {}
  const riderIds = new Set<string>()
  for (const [key, val] of Object.entries(raw ?? {})) {
    if (!VALID_ROLES.has(key)) continue
    if (val === null) { cleaned[key] = null; continue }
    if (typeof val !== 'string') continue
    cleaned[key] = val
    riderIds.add(val)
  }
  if (riderIds.size === 0) return cleaned

  // Verificér ejerskab: rytter-id skal være i squad'ens base-roster ELLER
  // være blevet byttet ind via transfer. Out-byttede ryttere accepteres også
  // (preset gemt før transfer skal stadig kunne læses tilbage).
  const [{ data: base }, { data: transfers }] = await Promise.all([
    supabaseAdmin.from('cycling_squad_riders').select('rider_id').eq('squad_id', squadId),
    supabaseAdmin.from('cycling_squad_transfers').select('rider_in_id').eq('squad_id', squadId),
  ])
  const ownedIds = new Set<string>()
  for (const r of base ?? []) ownedIds.add(r.rider_id as string)
  for (const t of transfers ?? []) ownedIds.add(t.rider_in_id as string)
  for (const [key, val] of Object.entries(cleaned)) {
    if (val !== null && !ownedIds.has(val)) cleaned[key] = null
  }
  return cleaned
}

async function assertGameMembership(gameId: number, userId: string) {
  const { data: member } = await supabaseAdmin
    .from('game_members').select('id')
    .eq('game_id', gameId).eq('user_id', userId).maybeSingle()
  return !!member
}

async function assertSquadOwnership(squadId: string, userId: string, gameId: number) {
  const { data: sq } = await supabaseAdmin
    .from('cycling_squads').select('id, user_id, game_id')
    .eq('id', squadId).maybeSingle()
  return !!sq && sq.user_id === userId && sq.game_id === gameId
}

/**
 * GET /api/games/[id]/cycling/presets
 * Returnerer alle presets på tværs af brugerens squads i dette spil.
 * Klienten filtrerer pr. squad/blok i UI.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = Number(id)
  if (!gameId) return NextResponse.json({ error: 'Ugyldigt spil-id' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })
  if (!(await assertGameMembership(gameId, user.id))) {
    return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })
  }

  const { data: squads } = await supabaseAdmin
    .from('cycling_squads').select('id')
    .eq('game_id', gameId).eq('user_id', user.id)
  const squadIds = (squads ?? []).map((s) => s.id as string)
  if (squadIds.length === 0) return NextResponse.json({ presets: [] })

  const { data: presets, error } = await supabaseAdmin
    .from('cycling_lineup_presets')
    .select('id, squad_id, name, slot_index, slots, updated_at')
    .in('squad_id', squadIds)
    .order('slot_index', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ presets: presets ?? [] })
}

/**
 * PUT /api/games/[id]/cycling/presets
 * Body: { squad_id, slot_index (0..MAX-1), name, slots }
 * Upsert pr. (squad_id, slot_index) — overskriver eksisterende preset i
 * samme slot.
 */
export async function PUT(req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = Number(id)
  if (!gameId) return NextResponse.json({ error: 'Ugyldigt spil-id' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as PresetBody
  const squadId = body.squad_id?.trim()
  const slotIndex = body.slot_index
  const name = (body.name ?? '').trim()
  if (!squadId) return NextResponse.json({ error: 'squad_id mangler' }, { status: 400 })
  if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex >= MAX_PRESETS_PER_SQUAD) {
    return NextResponse.json({ error: `slot_index skal være 0..${MAX_PRESETS_PER_SQUAD - 1}` }, { status: 400 })
  }
  if (name.length < 1 || name.length > 24) {
    return NextResponse.json({ error: 'Navn skal være 1-24 tegn' }, { status: 400 })
  }
  if (!(await assertSquadOwnership(squadId, user.id, gameId))) {
    return NextResponse.json({ error: 'Du ejer ikke denne squad' }, { status: 403 })
  }

  const cleanSlots = await sanitizeSlots(squadId, body.slots ?? {})

  const { data: upserted, error } = await supabaseAdmin
    .from('cycling_lineup_presets')
    .upsert(
      { squad_id: squadId, slot_index: slotIndex, name, slots: cleanSlots },
      { onConflict: 'squad_id,slot_index' },
    )
    .select('id, squad_id, name, slot_index, slots, updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ preset: upserted })
}

/**
 * DELETE /api/games/[id]/cycling/presets?squad_id=...&slot_index=N
 * Sletter ét preset i den givne slot.
 */
export async function DELETE(req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = Number(id)
  if (!gameId) return NextResponse.json({ error: 'Ugyldigt spil-id' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const url = new URL(req.url)
  const squadId = url.searchParams.get('squad_id') ?? ''
  const slotIndex = Number(url.searchParams.get('slot_index'))
  if (!squadId || Number.isNaN(slotIndex)) {
    return NextResponse.json({ error: 'squad_id + slot_index kræves' }, { status: 400 })
  }
  if (!(await assertSquadOwnership(squadId, user.id, gameId))) {
    return NextResponse.json({ error: 'Du ejer ikke denne squad' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('cycling_lineup_presets')
    .delete()
    .eq('squad_id', squadId)
    .eq('slot_index', slotIndex)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
