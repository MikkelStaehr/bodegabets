import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { isStageDeadlinePassed } from '@/lib/cyclingDeadline'
import {
  getCurrentEffectiveSquad,
  MAX_TRANSFERS_PER_REST_DAY,
} from '@/lib/cyclingTransfers'

const CAT_LIMITS: Record<number, number> = { 1: 3, 2: 5, 3: 5, 4: 5, 5: 7 }
const MAX_PER_TEAM = 3

type Props = { params: Promise<{ id: string }> }

type Swap = { rider_out_id: string; rider_in_id: string }

// ── GET: hent transfers for en rest_day ─────────────────────────────────────
// Query: ?race_id=UUID&rest_day_date=YYYY-MM-DD

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const raceId = req.nextUrl.searchParams.get('race_id')
  const restDay = req.nextUrl.searchParams.get('rest_day_date')
  if (!raceId || !restDay) {
    return NextResponse.json({ error: 'race_id og rest_day_date mangler' }, { status: 400 })
  }

  // Find squad for denne race (via aktiv block)
  const squad = await findSquadForRace(Number(gameId), user.id, raceId)
  if (!squad) return NextResponse.json({ transfers: [], remaining: MAX_TRANSFERS_PER_REST_DAY })

  const { data: transfers } = await supabaseAdmin
    .from('cycling_squad_transfers')
    .select('id, rider_out_id, rider_in_id, rider_in_category, created_at')
    .eq('squad_id', squad.id)
    .eq('race_id', raceId)
    .eq('rest_day_date', restDay)

  const count = transfers?.length ?? 0
  return NextResponse.json({
    transfers: transfers ?? [],
    remaining: Math.max(0, MAX_TRANSFERS_PER_REST_DAY - count),
  })
}

// ── POST: udfør transfers for en rest_day (replace-semantic) ────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const body = await req.json()
  const raceId: string = body.race_id
  const restDay: string = body.rest_day_date
  const swaps: Swap[] = body.swaps ?? []

  if (!raceId || !restDay) {
    return NextResponse.json({ error: 'race_id og rest_day_date mangler' }, { status: 400 })
  }
  if (!Array.isArray(swaps) || swaps.length === 0) {
    return NextResponse.json({ error: 'Ingen swaps angivet' }, { status: 400 })
  }
  if (swaps.length > MAX_TRANSFERS_PER_REST_DAY) {
    return NextResponse.json({
      error: `Max ${MAX_TRANSFERS_PER_REST_DAY} swaps pr. hviledag`,
    }, { status: 400 })
  }

  // Verify membership
  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', Number(gameId))
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  // Verify rest_day_date findes på racen
  const { data: race } = await supabaseAdmin
    .from('cycling_races')
    .select('id, rest_days')
    .eq('id', raceId)
    .single()
  if (!race) return NextResponse.json({ error: 'Race ikke fundet' }, { status: 404 })
  const restDays = (race.rest_days as string[] | null) ?? []
  if (!restDays.includes(restDay)) {
    return NextResponse.json({ error: 'Ugyldig hviledag for dette race' }, { status: 400 })
  }

  // Tjek deadline: transfer window lukker når første etape EFTER restDay starter - 30 min
  const { data: nextStages } = await supabaseAdmin
    .from('cycling_stages')
    .select('start_date, start_time_utc')
    .eq('race_id', raceId)
    .gt('start_date', restDay)
    .order('start_date', { ascending: true })
    .limit(1)

  const nextStage = nextStages?.[0] as { start_date?: string; start_time_utc?: string | null } | undefined
  if (nextStage?.start_date && isStageDeadlinePassed(nextStage.start_date, undefined, nextStage.start_time_utc)) {
    return NextResponse.json({ error: 'Transfer deadline er passeret' }, { status: 403 })
  }

  // Find squad
  const squad = await findSquadForRace(Number(gameId), user.id, raceId)
  if (!squad) return NextResponse.json({ error: 'Ingen brutto-trup for dette race' }, { status: 400 })

  // Nuværende effektive trup (efter eventuelle tidligere transfers)
  const currentSquad = await getCurrentEffectiveSquad(squad.id, raceId)
  const currentIds = new Set(currentSquad.map((r) => r.rider_id))

  // Valider swaps
  const outIds = new Set<string>()
  const inIds = new Set<string>()
  for (const swap of swaps) {
    if (!swap.rider_out_id || !swap.rider_in_id) {
      return NextResponse.json({ error: 'Ugyldig swap' }, { status: 400 })
    }
    if (!currentIds.has(swap.rider_out_id)) {
      return NextResponse.json({
        error: 'rider_out er ikke i din brutto-trup',
      }, { status: 400 })
    }
    if (currentIds.has(swap.rider_in_id)) {
      return NextResponse.json({
        error: 'rider_in er allerede i din brutto-trup',
      }, { status: 400 })
    }
    if (outIds.has(swap.rider_out_id) || inIds.has(swap.rider_in_id)) {
      return NextResponse.json({ error: 'Duplikeret rytter i swaps' }, { status: 400 })
    }
    outIds.add(swap.rider_out_id)
    inIds.add(swap.rider_in_id)
  }

  // Verificér at rider_in er i racens startliste
  const { data: startlist } = await supabaseAdmin
    .from('cycling_startlists')
    .select('rider_id')
    .eq('race_id', raceId)
    .in('rider_id', [...inIds])
  const startlistIds = new Set((startlist ?? []).map((s) => s.rider_id as string))
  for (const inId of inIds) {
    if (!startlistIds.has(inId)) {
      return NextResponse.json({
        error: 'Ny rytter skal være på racens startliste',
      }, { status: 400 })
    }
  }

  // Hent rider-detaljer for kategori/hold-validering
  const allRiderIds = [...new Set([...outIds, ...inIds])]
  const { data: riders } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, category, team_name')
    .in('id', allRiderIds)
  const riderMap = new Map(
    (riders ?? []).map((r) => [r.id as string, { category: r.category as number, team_name: r.team_name as string }])
  )

  // Byg ny effektiv trup-visning og valider limits
  const squadAfter = currentSquad.filter((r) => !outIds.has(r.rider_id))
  for (const swap of swaps) {
    const info = riderMap.get(swap.rider_in_id)
    if (!info) return NextResponse.json({ error: 'rider_in findes ikke' }, { status: 400 })
    squadAfter.push({ rider_id: swap.rider_in_id, category_slot: info.category })
  }

  // Categories
  const { data: allSquadRiderInfo } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, team_name')
    .in('id', squadAfter.map((r) => r.rider_id))
  const teamByRider = new Map(
    (allSquadRiderInfo ?? []).map((r) => [r.id as string, r.team_name as string])
  )

  const catCount: Record<number, number> = {}
  const teamCount: Record<string, number> = {}
  for (const r of squadAfter) {
    catCount[r.category_slot] = (catCount[r.category_slot] ?? 0) + 1
    const team = teamByRider.get(r.rider_id)
    if (team) teamCount[team] = (teamCount[team] ?? 0) + 1
  }
  for (const [cat, limit] of Object.entries(CAT_LIMITS)) {
    const count = catCount[Number(cat)] ?? 0
    if (count > limit) {
      return NextResponse.json({
        error: `Max ${limit} i kategori ${cat} (efter swap: ${count})`,
      }, { status: 400 })
    }
  }
  for (const [team, count] of Object.entries(teamCount)) {
    if (count > MAX_PER_TEAM) {
      return NextResponse.json({
        error: `Max ${MAX_PER_TEAM} fra ${team} (efter swap: ${count})`,
      }, { status: 400 })
    }
  }

  // Slet eksisterende transfers for denne rest_day og indsæt nye (replace-semantic)
  await supabaseAdmin
    .from('cycling_squad_transfers')
    .delete()
    .eq('squad_id', squad.id)
    .eq('race_id', raceId)
    .eq('rest_day_date', restDay)

  const rows = swaps.map((s) => ({
    squad_id: squad.id,
    race_id: raceId,
    rest_day_date: restDay,
    rider_out_id: s.rider_out_id,
    rider_in_id: s.rider_in_id,
    rider_in_category: riderMap.get(s.rider_in_id)?.category ?? 5,
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('cycling_squad_transfers')
    .insert(rows)

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: swaps.length })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function findSquadForRace(
  gameId: number,
  userId: string,
  raceId: string,
): Promise<{ id: string } | null> {
  // Find den block som indeholder dette race, og squad for den block
  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('cycling_block_id')
    .eq('game_id', gameId)
    .eq('race_id', raceId)
    .maybeSingle()

  const blockId = gameRaces?.cycling_block_id as string | undefined

  const squadQuery = supabaseAdmin
    .from('cycling_squads')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', userId)

  if (blockId) squadQuery.eq('cycling_block_id', blockId)

  const { data: squad } = await squadQuery.maybeSingle()
  return squad as { id: string } | null
}
