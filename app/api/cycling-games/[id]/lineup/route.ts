/*
  SQL — kør manuelt i Supabase før deploy:

  ALTER TABLE cycling_lineups
  ADD CONSTRAINT cycling_lineups_squad_race_unique
  UNIQUE (squad_id, race_id);

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

type Props = { params: Promise<{ id: string }> }

const ROLE_LIMITS: Record<string, number> = {
  leader: 1,
  lieutenant: 1,
  grimpeur: 1,
  sprinter: 1,
  domestique: 1,
  equipier: 2,
  joker: 1,
}

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
    .select('id, race_id, is_locked')
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
    .select('lineup_id, rider_id, race_id, role, is_bench, base_points, role_bonus, role_multiplier, jersey_points, team_bonus, bench_penalty, dnf_penalty, total_points')
    .in('lineup_id', lineupIds)

  const scoresByLineup = new Map<string, typeof allScores>()
  for (const s of allScores ?? []) {
    const key = String(s.lineup_id)
    if (!scoresByLineup.has(key)) scoresByLineup.set(key, [])
    scoresByLineup.get(key)!.push(s)
  }

  // Fetch race results — kun for løb med status 'finished'
  const allRiderIds = [...new Set((lineupRiders ?? []).map((lr) => lr.rider_id))]

  // Find finished race IDs only
  const { data: finishedRaces } = await supabaseAdmin
    .from('cycling_races')
    .select('id')
    .in('id', lineups.map((l) => l.race_id))
    .eq('status', 'finished')

  const finishedRaceIds = (finishedRaces ?? []).map((r) => r.id)

  let resultsByRace = new Map<string, Map<string, { position: number | null; dnf: boolean; abandon_type: string | null; jersey: string | null }>>()
  if (allRiderIds.length > 0 && finishedRaceIds.length > 0) {
    const { data: raceResults } = await supabaseAdmin
      .from('cycling_results')
      .select('race_id, rider_id, position, dnf, abandon_type, jersey')
      .in('race_id', finishedRaceIds)
      .in('rider_id', allRiderIds)

    for (const rr of raceResults ?? []) {
      const raceKey = String(rr.race_id)
      if (!resultsByRace.has(raceKey)) resultsByRace.set(raceKey, new Map())
      resultsByRace.get(raceKey)!.set(String(rr.rider_id), {
        position: rr.position, dnf: rr.dnf ?? false,
        abandon_type: rr.abandon_type ?? null, jersey: rr.jersey ?? null,
      })
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
      jersey_points: Number(s.jersey_points),
      team_bonus: Number(s.team_bonus),
      bench_penalty: Number(s.bench_penalty),
      dnf_penalty: Number(s.dnf_penalty),
      total_points: Number(s.total_points),
    }))

    const raceResults = resultsByRace.get(String(lineup.race_id))
    const resultsArr = riders
      .map((r) => {
        const rr = raceResults?.get(String(r.rider_id))
        return rr ? { rider_id: r.rider_id, ...rr } : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    return {
      race_id: lineup.race_id,
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
  const { race_id, riders } = body as {
    race_id: string
    riders: { rider_id: string; role: string; slot_index: number }[]
  }

  if (!race_id || !Array.isArray(riders)) {
    return NextResponse.json({ error: 'Ugyldigt input' }, { status: 400 })
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

  // Valider antal per rolle
  const roleCounts: Record<string, number> = {}
  for (const r of riders) {
    const baseRole = r.role.startsWith('equipier_') ? 'equipier' : r.role
    roleCounts[baseRole] = (roleCounts[baseRole] ?? 0) + 1
  }
  for (const [role, limit] of Object.entries(ROLE_LIMITS)) {
    const count = roleCounts[role] ?? 0
    if (count > limit) {
      return NextResponse.json({ error: `Max ${limit} rytter(e) som ${role}` }, { status: 400 })
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

  // Valider at alle ryttere er i brutto truppen
  const { data: squadRiders } = await supabaseAdmin
    .from('cycling_squad_riders')
    .select('rider_id')
    .eq('squad_id', squad.id)

  const squadRiderIds = new Set((squadRiders ?? []).map((sr) => sr.rider_id))
  for (const r of riders) {
    if (!squadRiderIds.has(r.rider_id)) {
      return NextResponse.json({ error: 'Rytter er ikke i din brutto trup' }, { status: 400 })
    }
  }

  // Valider kategori-regler per rolle
  const catRuleRiders = riders.filter((r) => {
    const baseRole = r.role.startsWith('equipier_') ? 'equipier' : r.role
    return baseRole in CAT_RULES
  })

  if (catRuleRiders.length > 0) {
    const { data: riderDetails } = await supabaseAdmin
      .from('cycling_riders')
      .select('id, category')
      .in('id', catRuleRiders.map((r) => r.rider_id))

    const catById = new Map((riderDetails ?? []).map((r) => [r.id, r.category]))

    for (const r of catRuleRiders) {
      const baseRole = r.role.startsWith('equipier_') ? 'equipier' : r.role
      const allowed = CAT_RULES[baseRole]
      if (!allowed) continue
      const cat = catById.get(r.rider_id)
      if (cat != null && !allowed.includes(cat)) {
        return NextResponse.json({
          error: `${baseRole} kræver kat ${allowed.join('/')} — rytteren er kat ${cat}`,
        }, { status: 400 })
      }
    }
  }

  // Upsert lineup
  const { data: lineup, error: lineupErr } = await supabaseAdmin
    .from('cycling_lineups')
    .upsert(
      { squad_id: squad.id, race_id, is_locked: false, updated_at: new Date().toISOString() },
      { onConflict: 'squad_id,race_id' }
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
