/*
  SQL — kør manuelt i Supabase før deploy:

  ALTER TABLE cycling_lineups
  ADD CONSTRAINT cycling_lineups_squad_stage_unique
  UNIQUE (squad_id, stage_id);

  ALTER TABLE cycling_lineup_riders
  ADD COLUMN IF NOT EXISTS slot_index integer NOT NULL DEFAULT 0;

  -- Hvis updated_at ikke findes:
  ALTER TABLE cycling_lineups
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

  -- Fix: udvid role check constraint til at inkludere alle roller
  ALTER TABLE cycling_lineup_riders
  DROP CONSTRAINT IF EXISTS cycling_lineup_riders_role_check;

  ALTER TABLE cycling_lineup_riders
  ADD CONSTRAINT cycling_lineup_riders_role_check
  CHECK (role IN (
    'leader', 'lieutenant', 'grimpeur', 'sprinter',
    'domestique', 'equipier', 'joker',
    'captain', 'solo_attack', 'sprint_assist',
    'bench', 'bench_1', 'bench_2', 'bench_3', 'bench_4',
    'helper', 'helper_0', 'helper_1', 'helper_2', 'luxury_helper'
  ));
*/

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { isStageDeadlinePassed } from '@/lib/cyclingDeadline'
import { slotsForProfile } from '@/lib/cyclingRoles'
import { getEffectiveSquadRiders } from '@/lib/cyclingTransfers'

type Props = { params: Promise<{ id: string }> }

const CAT_RULES: Record<string, number[]> = {
  lieutenant: [2, 3],
  grimpeur: [3, 4, 5],
  sprinter: [1, 2, 3],
  domestique: [4],
}

// ── GET: hent brugerens lineups ────────────────────────────────────────────

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
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!squad) return NextResponse.json({ lineups: [] })

  const { data: lineups } = await supabaseAdmin
    .from('cycling_lineups')
    .select('id, race_id, stage_id, is_locked')
    .eq('squad_id', squad.id)

  if (!lineups?.length) return NextResponse.json({ lineups: [] })

  const lineupIds = lineups.map((l) => l.id)

  const { data: lineupRiders } = await supabaseAdmin
    .from('cycling_lineup_riders')
    .select(`
      lineup_id,
      rider_id,
      role,
      slot_index,
      rider:cycling_riders!inner(
        id, first_name, last_name, team_name, category
      )
    `)
    .in('lineup_id', lineupIds)

  const ridersByLineup = new Map<string, typeof lineupRiders>()
  for (const lr of lineupRiders ?? []) {
    const key = String(lr.lineup_id)
    if (!ridersByLineup.has(key)) ridersByLineup.set(key, [])
    ridersByLineup.get(key)!.push(lr)
  }

  // Fetch scores for all lineups
  const { data: allScores } = await supabaseAdmin
    .from('cycling_scores')
    .select('lineup_id, rider_id, race_id, role, is_bench, base_points, role_bonus, role_multiplier, gc_multiplier, cat_multiplier, profile_multiplier, train_multiplier, jersey_points, team_bonus, break_points, total_points')
    .in('lineup_id', lineupIds)

  const scoresByLineup = new Map<string, typeof allScores>()
  for (const s of allScores ?? []) {
    const key = String(s.lineup_id)
    if (!scoresByLineup.has(key)) scoresByLineup.set(key, [])
    scoresByLineup.get(key)!.push(s)
  }

  // Fetch race results for lineup riders. Resultater er per (race, stage,
  // rider) i cycling_results, så vi mapper på den sammensatte nøgle —
  // ellers ville alle stage-races dele én lookup per race og overskrive
  // hinanden. Bemærk: før filtrerede vi på status='finished' her, hvilket
  // skjulte stage 1-resultater i en active Grand Tour — drop'et bevidst.
  const allRiderIds = [...new Set((lineupRiders ?? []).map((lr) => lr.rider_id))]
  const allRaceIds = [...new Set(lineups.map((l) => l.race_id))]

  // Map nøglet på (race_id, stage_number) → Map<rider_id, result>.
  // For stages-races: hver stage får sin egen entry. For one-day races:
  // stage_number = 1 (PCS-konvention).
  const resultsByStage = new Map<
    string,
    Map<string, { position: number | null; dnf: boolean; abandon_type: string | null; jersey: string | null }>
  >()

  if (allRiderIds.length > 0 && allRaceIds.length > 0) {
    const { data: raceResults } = await supabaseAdmin
      .from('cycling_results')
      .select('race_id, stage_number, rider_id, position, dnf, abandon_type, jersey')
      .in('race_id', allRaceIds)
      .in('rider_id', allRiderIds)

    for (const rr of raceResults ?? []) {
      const stageKey = `${rr.race_id}::${rr.stage_number}`
      if (!resultsByStage.has(stageKey)) resultsByStage.set(stageKey, new Map())
      resultsByStage.get(stageKey)!.set(String(rr.rider_id), {
        position: rr.position, dnf: rr.dnf ?? false,
        abandon_type: rr.abandon_type ?? null, jersey: rr.jersey ?? null,
      })
    }
  }

  // Vi skal kunne mappe lineup.stage_id → stage_number for at slå op i resultsByStage.
  const stageIds = [...new Set(lineups.map((l) => l.stage_id).filter((s): s is string => !!s))]
  const stageNumberById = new Map<string, number>()
  if (stageIds.length > 0) {
    const { data: stageRows } = await supabaseAdmin
      .from('cycling_stages')
      .select('id, stage_number')
      .in('id', stageIds)
    for (const s of stageRows ?? []) {
      stageNumberById.set(String(s.id), s.stage_number)
    }
  }

  const result = lineups.map((lineup) => {
    const riders = (ridersByLineup.get(String(lineup.id)) ?? []).map((lr) => {
      const r = lr.rider as unknown as {
        id: string; first_name: string; last_name: string
        team_name: string; category: number
      }
      return {
        rider_id: r.id,
        role: lr.role,
        slot_index: lr.slot_index,
        first_name: r.first_name,
        last_name: r.last_name,
        team_name: r.team_name,
        category: r.category,
      }
    })

    const scores = (scoresByLineup.get(String(lineup.id)) ?? []).map((s) => ({
      rider_id: s.rider_id,
      role: s.role,
      is_bench: s.is_bench,
      base_points: Number(s.base_points),
      role_bonus: Number(s.role_bonus),
      role_multiplier: Number(s.role_multiplier),
      gc_multiplier: Number(s.gc_multiplier ?? 1),
      jersey_points: Number(s.jersey_points),
      team_bonus: Number(s.team_bonus),
      total_points: Number(s.total_points),
    }))

    // For stage-races: brug lineup.stage_id → stage_number. For one-day
    // (ingen stage_id): default til 1 (PCS-konvention).
    const lineupStageNumber = lineup.stage_id
      ? stageNumberById.get(String(lineup.stage_id)) ?? null
      : 1
    const stageResults =
      lineupStageNumber != null
        ? resultsByStage.get(`${lineup.race_id}::${lineupStageNumber}`)
        : undefined
    const resultsArr = riders
      .map((r) => {
        const rr = stageResults?.get(String(r.rider_id))
        return rr ? { rider_id: r.rider_id, ...rr } : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    return {
      race_id: lineup.race_id,
      stage_id: lineup.stage_id,
      is_locked: lineup.is_locked,
      riders,
      scores,
      results: resultsArr,
    }
  })

  return NextResponse.json({ lineups: result })
}

// ── POST: gem lineup for ét løb ────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const body = await req.json()
  const { race_id, stage_id, riders } = body as {
    race_id: string
    stage_id: string
    riders: { rider_id: string; role: string; slot_index: number }[]
  }

  if (!race_id || !stage_id || !Array.isArray(riders)) {
    return NextResponse.json({ error: 'Ugyldigt input (race_id, stage_id og riders påkrævet)' }, { status: 400 })
  }

  // Find brugerens squad
  const { data: squad } = await supabaseAdmin
    .from('cycling_squads')
    .select('id')
    .eq('game_id', Number(gameId))
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!squad) return NextResponse.json({ error: 'Ingen brutto trup fundet' }, { status: 400 })

  // Tjek deadline — find stage → race → block lock_deadline, eller stage start - 30 min
  const { data: stageData } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, race_id, start_date, start_time_utc, profile')
    .eq('id', stage_id)
    .single()

  // Check deadline. Fail-closed: hvis start_date mangler kan vi ikke verificere.
  if (!stageData?.start_date) {
    return NextResponse.json({
      error: 'Etape-data mangler — kontakt admin'
    }, { status: 500 })
  }
  if (isStageDeadlinePassed(stageData.start_date, undefined, stageData.start_time_utc as string | null)) {
    return NextResponse.json({ error: 'Deadline er passeret — lineup kan ikke ændres' }, { status: 400 })
  }

  // Valider rolle-sammensætning mod den DYNAMISKE formation for etapens profil
  // (samme kilde som builderen). Flad/bjerg tillader 3 equipiers, bakket 2 osv.
  const allowedSlots = slotsForProfile((stageData as { profile?: string | null }).profile, stageData.start_date)
  const roleLimits: Record<string, number> = {}
  for (const key of allowedSlots) {
    const base = key.startsWith('equipier_') ? 'equipier' : key
    roleLimits[base] = (roleLimits[base] ?? 0) + 1
  }
  const roleCounts: Record<string, number> = {}
  for (const r of riders) {
    const baseRole = r.role.startsWith('equipier_') ? 'equipier' : r.role
    roleCounts[baseRole] = (roleCounts[baseRole] ?? 0) + 1
  }
  for (const [role, count] of Object.entries(roleCounts)) {
    const limit = roleLimits[role] ?? 0
    if (count > limit) {
      return NextResponse.json({
        error: limit === 0
          ? `${role} kan ikke vælges på denne etape-profil`
          : `Max ${limit} rytter(e) som ${role}`,
      }, { status: 400 })
    }
  }

  // Total max 8
  if (riders.length > 8) {
    return NextResponse.json({ error: 'Max 8 ryttere i aktiv lineup' }, { status: 400 })
  }

  // Tjek for dubletter
  const riderIdSet = new Set(riders.map((r) => r.rider_id))
  if (riderIdSet.size !== riders.length) {
    return NextResponse.json({ error: 'Samme rytter kan ikke vælges to gange' }, { status: 400 })
  }

  // Valider at alle ryttere er i den EFFEKTIVE brutto-trup (med hviledags-
  // transfers anvendt frem til etapens dato): en rytter byttet UD kan ikke
  // vælges, en rytter byttet IND kan. Tidligere blev kun den oprindelige trup
  // tjekket, så udbyttede ryttere slap igennem.
  const effSquad = await getEffectiveSquadRiders(squad.id, stageData.race_id, stageData.start_date)
  const effCatById = new Map(effSquad.map((sr) => [sr.rider_id, sr.category_slot]))
  for (const r of riders) {
    if (!effCatById.has(r.rider_id)) {
      return NextResponse.json({ error: 'Rytter er ikke i din (effektive) brutto trup' }, { status: 400 })
    }
  }

  // Valider kategori-regler per rolle (kategori fra effektiv trup — incl.
  // transfer-ind-rytteres kategori).
  for (const r of riders) {
    const baseRole = r.role.startsWith('equipier_') ? 'equipier' : r.role
    const allowed = CAT_RULES[baseRole]
    if (!allowed) continue
    const cat = effCatById.get(r.rider_id)
    if (cat != null && !allowed.includes(cat)) {
      return NextResponse.json({
        error: `${baseRole} kræver kat ${allowed.join('/')} — rytteren er kat ${cat}`,
      }, { status: 400 })
    }
  }

  // TTT: max 2 ryttere fra samme hold i lineup'et. På en holdetape vil nogle
  // få hold typisk vinde, så uden et loft kunne man stacke vinderholdet. Med
  // max 2 (og 6 slots) bliver det et spil om at ramme de rigtige hold.
  if ((stageData as { profile?: string | null }).profile === 'ttt') {
    const { data: riderTeams } = await supabaseAdmin
      .from('cycling_riders')
      .select('id, team_name')
      .in('id', riders.map((r) => r.rider_id))
    const teamById = new Map<string, string>()
    for (const rt of riderTeams ?? []) teamById.set(rt.id as string, rt.team_name as string)
    const teamCounts: Record<string, number> = {}
    for (const r of riders) {
      const team = teamById.get(r.rider_id) ?? '—'
      teamCounts[team] = (teamCounts[team] ?? 0) + 1
      if (teamCounts[team] > 2) {
        return NextResponse.json({ error: `Max 2 ryttere fra samme hold på en holdtempo-etape (${team})` }, { status: 400 })
      }
    }
  }

  // Upsert lineup
  const { data: lineup, error: lineupErr } = await supabaseAdmin
    .from('cycling_lineups')
    .upsert(
      { squad_id: squad.id, race_id, stage_id, is_locked: false, updated_at: new Date().toISOString() },
      { onConflict: 'squad_id,stage_id' }
    )
    .select('id, is_locked')
    .single()

  if (lineupErr) return NextResponse.json({ error: lineupErr.message }, { status: 500 })

  if (lineup.is_locked) {
    return NextResponse.json({ error: 'Lineup er låst og kan ikke ændres' }, { status: 400 })
  }

  // Slet eksisterende lineup riders
  await supabaseAdmin
    .from('cycling_lineup_riders')
    .delete()
    .eq('lineup_id', lineup.id)

  // Insert nye lineup riders
  const rows = riders.map((r) => ({
    lineup_id: lineup.id,
    rider_id: r.rider_id,
    role: r.role,
    slot_index: r.slot_index,
    is_active: true,
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('cycling_lineup_riders')
    .insert(rows)

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ success: true, lineup_id: lineup.id })
}
