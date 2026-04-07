import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

const CAT_LIMITS: Record<number, number> = { 1: 3, 2: 5, 3: 5, 4: 5, 5: 7 }
const MAX_TOTAL = 25
const MAX_PER_TEAM = 3

type Props = { params: Promise<{ id: string }> }

// ── GET: hent brugerens brutto trup ─────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params

  const { data: squad } = await supabaseAdmin
    .from('cycling_squads')
    .select('id')
    .eq('game_id', Number(gameId))
    .eq('user_id', user.id)
    .maybeSingle()

  if (!squad) return NextResponse.json({ riders: [] })

  const { data: squadRiders } = await supabaseAdmin
    .from('cycling_squad_riders')
    .select(`
      rider_id,
      rider:cycling_riders!inner(
        id, first_name, last_name, team_name, category, team_logo_url, photo_url
      )
    `)
    .eq('squad_id', squad.id)

  const riders = (squadRiders ?? []).map((row) => {
    const r = row.rider as unknown as {
      id: string; first_name: string; last_name: string
      team_name: string; category: number; team_logo_url: string | null; photo_url: string | null
    }
    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      team_name: r.team_name,
      category: r.category,
      team_logo_url: r.team_logo_url,
      photo_url: r.photo_url,
    }
  })

  return NextResponse.json({ riders })
}

// ── POST: gem brutto trup ───────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const body = await req.json()
  const riderIds: string[] = body.rider_ids

  if (!Array.isArray(riderIds) || riderIds.length === 0) {
    return NextResponse.json({ error: 'Vælg mindst én rytter' }, { status: 400 })
  }
  if (riderIds.length > MAX_TOTAL) {
    return NextResponse.json({ error: `Max ${MAX_TOTAL} ryttere` }, { status: 400 })
  }

  // Verify membership
  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', Number(gameId))
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  // Fetch rider details for validation
  const { data: riders } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, category, team_name')
    .in('id', riderIds)

  if (!riders || riders.length !== riderIds.length) {
    return NextResponse.json({ error: 'Ugyldige ryttere' }, { status: 400 })
  }

  // Validate category limits
  const catCount: Record<number, number> = {}
  for (const r of riders) {
    catCount[r.category] = (catCount[r.category] ?? 0) + 1
  }
  for (const [cat, limit] of Object.entries(CAT_LIMITS)) {
    const count = catCount[Number(cat)] ?? 0
    if (count > limit) {
      return NextResponse.json({
        error: `Max ${limit} ryttere i kategori ${cat} (du har ${count})`,
      }, { status: 400 })
    }
  }

  // Validate team limits
  const teamCount: Record<string, number> = {}
  for (const r of riders) {
    teamCount[r.team_name] = (teamCount[r.team_name] ?? 0) + 1
  }
  for (const [team, count] of Object.entries(teamCount)) {
    if (count > MAX_PER_TEAM) {
      return NextResponse.json({
        error: `Max ${MAX_PER_TEAM} ryttere fra samme hold (${team}: ${count})`,
      }, { status: 400 })
    }
  }

  // Find aktiv blok (lavest block_order med fremtidig deadline, ingen parent)
  const { data: activeBlock } = await supabaseAdmin
    .from('cycling_blocks')
    .select('id')
    .eq('game_id', Number(gameId))
    .is('parent_block_id', null)
    .gt('lock_deadline', new Date().toISOString())
    .order('block_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Upsert squad
  const { data: squad, error: squadErr } = await supabaseAdmin
    .from('cycling_squads')
    .upsert(
      { game_id: Number(gameId), user_id: user.id, cycling_block_id: activeBlock?.id ?? null },
      { onConflict: 'game_id,user_id' }
    )
    .select('id')
    .single()

  if (squadErr) return NextResponse.json({ error: squadErr.message }, { status: 500 })

  // Delete existing riders and insert new
  await supabaseAdmin
    .from('cycling_squad_riders')
    .delete()
    .eq('squad_id', squad.id)

  const catByRider = new Map(riders.map((r) => [r.id, r.category]))
  const rows = riderIds.map((riderId) => ({
    squad_id: squad.id,
    rider_id: riderId,
    category_slot: catByRider.get(riderId) ?? 5,
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('cycling_squad_riders')
    .insert(rows)

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: riderIds.length })
}
