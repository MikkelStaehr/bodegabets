import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { getCurrentEffectiveSquad } from '@/lib/cyclingTransfers'
import { computeBlockSquadLimits, DEFAULT_MAX_TOTAL, MAX_PER_TEAM } from '@/lib/cyclingSquadLimits'

type Props = { params: Promise<{ id: string }> }

// ── GET: hent brugerens brutto trup ─────────────────────────────────────────
// Query:
//   ?block=UUID            → squad for specifik blok
//   ?race_id=UUID&effective=true → effektiv trup (efter anvendte transfers)

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const blockId = req.nextUrl.searchParams.get('block')
  const raceId = req.nextUrl.searchParams.get('race_id')
  const effective = req.nextUrl.searchParams.get('effective') === 'true'

  // Race-specifik lookup: find blok via cycling_game_races
  let resolvedBlockId = blockId
  if (!resolvedBlockId && raceId) {
    const { data: gr } = await supabaseAdmin
      .from('cycling_game_races')
      .select('cycling_block_id')
      .eq('game_id', Number(gameId))
      .eq('race_id', raceId)
      .maybeSingle()
    resolvedBlockId = (gr?.cycling_block_id as string | undefined) ?? null
  }

  const squadQuery = supabaseAdmin
    .from('cycling_squads')
    .select('id')
    .eq('game_id', Number(gameId))
    .eq('user_id', user.id)

  if (resolvedBlockId) {
    squadQuery.eq('cycling_block_id', resolvedBlockId)
  }

  const { data: squad } = await squadQuery.maybeSingle()

  if (!squad) return NextResponse.json({ riders: [] })

  // Hent rider-IDs: enten alle fra squad (default) eller effektiv (efter transfers)
  let riderIds: string[]
  if (effective && raceId) {
    const effSquad = await getCurrentEffectiveSquad(squad.id, raceId)
    riderIds = effSquad.map((r) => r.rider_id)
  } else {
    const { data: squadRiderRows } = await supabaseAdmin
      .from('cycling_squad_riders')
      .select('rider_id')
      .eq('squad_id', squad.id)
    riderIds = (squadRiderRows ?? []).map((r) => r.rider_id as string)
  }

  if (riderIds.length === 0) return NextResponse.json({ riders: [] })

  const { data: riders } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, first_name, last_name, team_name, category, team_logo_url, photo_url')
    .in('id', riderIds)

  return NextResponse.json({ riders: riders ?? [] })
}

// ── POST: gem brutto trup ───────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const body = await req.json()
  const riderIds: string[] = body.rider_ids
  const bodyBlockId: string | null = body.cycling_block_id ?? null

  if (!Array.isArray(riderIds) || riderIds.length === 0) {
    return NextResponse.json({ error: 'Vælg mindst én rytter' }, { status: 400 })
  }
  if (riderIds.length > DEFAULT_MAX_TOTAL) {
    return NextResponse.json({ error: `Max ${DEFAULT_MAX_TOTAL} ryttere` }, { status: 400 })
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

  // Compute dynamic limits baseret på blokkens startlister
  let blockRaceIdsForLimits: string[] = []
  if (bodyBlockId) {
    const { data: blockRaces } = await supabaseAdmin
      .from('cycling_game_races')
      .select('race_id')
      .eq('game_id', Number(gameId))
      .eq('cycling_block_id', bodyBlockId)
    blockRaceIdsForLimits = (blockRaces ?? []).map((r) => r.race_id as string)
  }
  const limits = await computeBlockSquadLimits(blockRaceIdsForLimits)

  if (riderIds.length > limits.maxTotal) {
    return NextResponse.json({
      error: `Max ${limits.maxTotal} ryttere for denne blok (du har ${riderIds.length})`,
    }, { status: 400 })
  }

  // Validate category limits (dynamiske)
  const catCount: Record<number, number> = {}
  for (const r of riders) {
    catCount[r.category] = (catCount[r.category] ?? 0) + 1
  }
  for (const [cat, limit] of Object.entries(limits.catLimits)) {
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

  // Brug block_id fra body (squad page) eller fallback til auto-detekteret blok
  const cyclingBlockId = bodyBlockId ?? activeBlock?.id ?? null

  // Upsert squad per blok
  const { data: squad, error: squadErr } = await supabaseAdmin
    .from('cycling_squads')
    .upsert(
      { game_id: Number(gameId), user_id: user.id, cycling_block_id: cyclingBlockId },
      { onConflict: 'game_id,user_id,cycling_block_id' }
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
