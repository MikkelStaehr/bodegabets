/*
  SQL — kør manuelt i Supabase før deploy:

  ALTER TABLE cycling_results ADD COLUMN IF NOT EXISTS jersey text;
  ALTER TABLE cycling_results ADD COLUMN IF NOT EXISTS abandon_type text;

  -- Vigtig: UNIQUE constraint på cycling_results forhindrer duplicates
  -- når sync_results.py kører upsert med on_conflict="race_id,rider_id,stage_number"
  ALTER TABLE cycling_results
    ADD CONSTRAINT cycling_results_unique UNIQUE (race_id, rider_id, stage_number);

  CREATE TABLE IF NOT EXISTS cycling_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lineup_id uuid NOT NULL REFERENCES cycling_lineups(id) ON DELETE CASCADE,
    rider_id uuid NOT NULL,
    race_id uuid NOT NULL,
    stage_id uuid NOT NULL REFERENCES cycling_stages(id) ON DELETE CASCADE,
    game_id int NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    role text NOT NULL,
    is_bench boolean NOT NULL DEFAULT false,
    base_points numeric NOT NULL DEFAULT 0,
    role_multiplier numeric NOT NULL DEFAULT 1,
    role_bonus numeric NOT NULL DEFAULT 0,
    jersey_points numeric NOT NULL DEFAULT 0,
    team_bonus numeric NOT NULL DEFAULT 0,
    bench_penalty numeric NOT NULL DEFAULT 0,
    dnf_penalty numeric NOT NULL DEFAULT 0,
    calculated_at timestamptz DEFAULT now(),
    UNIQUE (lineup_id, rider_id, stage_id),
    -- total_points er en generated column (DB beregner automatisk)
    total_points numeric GENERATED ALWAYS AS (
      (base_points * role_multiplier) + role_bonus + jersey_points + team_bonus + bench_penalty + dnf_penalty
    ) STORED
  );

  -- Hvis tabellen allerede findes med forkert total_points formel, ret den:
  --   ALTER TABLE cycling_scores DROP COLUMN total_points;
  --   ALTER TABLE cycling_scores ADD COLUMN total_points NUMERIC GENERATED ALWAYS AS (
  --     (base_points * role_multiplier) + role_bonus + jersey_points + team_bonus + bench_penalty + dnf_penalty
  --   ) STORED;
  --
  -- NB: bench_penalty og dnf_penalty lagres som NEGATIVE tal af koden.

  ALTER TABLE cycling_scores ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public read" ON cycling_scores FOR SELECT USING (true);

  -- Jersey rename (2026-04-17): migrér legacy color values til role-based keys
  UPDATE cycling_results SET jersey = REPLACE(REPLACE(REPLACE(REPLACE(
    jersey, 'yellow', 'leader'), 'green', 'points'), 'polka', 'mountain'), 'white', 'youth')
    WHERE jersey IS NOT NULL;

  -- Block status (2026-04-27): tilføj status til cycling_blocks så B. SEJR kan tildeles
  ALTER TABLE cycling_blocks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

  -- GC multiplier (2026-04-17): bonus for ryttere i top-10 sammenlagt efter etape
  ALTER TABLE cycling_results ADD COLUMN IF NOT EXISTS gc_position_after int;
  ALTER TABLE cycling_scores ADD COLUMN IF NOT EXISTS gc_multiplier numeric NOT NULL DEFAULT 1.0;
  -- Drop + gen-column er ikke idempotent — kør kun første gang:
  ALTER TABLE cycling_scores DROP COLUMN IF EXISTS total_points;
  ALTER TABLE cycling_scores ADD COLUMN total_points numeric GENERATED ALWAYS AS (
    (base_points * role_multiplier * gc_multiplier) + role_bonus + jersey_points + team_bonus + bench_penalty + dnf_penalty
  ) STORED;
*/

import { supabaseAdmin } from '@/lib/supabase'

// ── Point tables ────────────────────────────────────────────────────────────

const POSITION_POINTS: [number, number][] = [
  [1, 50],
  [3, 30],
  [5, 20],
  [10, 10],
  [20, 5],
]

const CAT_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 1.3,
  3: 1.7,
  4: 2.2,
  5: 3.5,
}

// Jersey keys er race-agnostiske (leader/points/mountain/youth) — den faktiske
// jersey-farve varierer per race (Tour=gul, Giro=pink, Vuelta=rød).
const JERSEY_POINTS: Record<string, number> = {
  leader: 8,
  points: 5,
  mountain: 5,
  youth: 3,
}

// GC-multiplier: bonus for ryttere i top-10 sammenlagt efter etape (kun stage races)
const GC_MULTIPLIER: Record<number, number> = {
  1: 1.4,
  2: 1.3, 3: 1.3,
  4: 1.2, 5: 1.2,
  6: 1.1, 7: 1.1, 8: 1.1, 9: 1.1, 10: 1.1,
}

const DNF_PENALTY_PCT = 0.5   // 50% of would-be score
const DNF_PENALTY_MIN = -5    // minimum penalty even if no placement points

// ── Helpers ─────────────────────────────────────────────────────────────────

function getBasePoints(position: number | null): number {
  if (position == null || position <= 0) return 0
  for (const [maxPos, pts] of POSITION_POINTS) {
    if (position <= maxPos) return pts
  }
  return 0
}

function getJerseyPoints(jerseyStr: string | null): number {
  if (!jerseyStr) return 0
  let total = 0
  for (const j of jerseyStr.split(',')) {
    total += JERSEY_POINTS[j.trim()] ?? 0
  }
  return total
}

function getJerseyList(jerseyStr: string | null): string[] {
  if (!jerseyStr) return []
  return jerseyStr.split(',').map((j) => j.trim()).filter(Boolean)
}

function getGcMultiplier(gcPosition: number | null): number {
  if (gcPosition == null) return 1.0
  return GC_MULTIPLIER[gcPosition] ?? 1.0
}

// ── Profile-based role multipliers ──────────────────────────────────────────

function getGrimpeurMultiplier(profile: string): number {
  if (profile === 'mountain') return 1.8
  if (profile === 'hilly') return 1.2
  return 1.0
}

function getSprinterMultiplier(profile: string): number {
  if (profile === 'flat' || profile === 'mixed') return 1.8
  if (profile === 'hilly') return 1.2
  return 1.0
}

const WON_HOW_SPRINTER_BONUS: Record<string, number> = {
  'Bunch sprint': 20,
  'Small group sprint': 25,
  'Sprint a deux': 50,
}

function getWonHowGrimpeurBonus(wonHow: string): number {
  if (wonHow === 'Sprint a deux') return 25
  if (wonHow === 'Small group sprint') return 20
  // "XX.xx km solo" → floor(km) bonus points + 50 base solo bonus
  const soloMatch = wonHow.match(/^([\d.]+)\s*km\s+solo$/i)
  if (soloMatch) return 50 + Math.floor(parseFloat(soloMatch[1]))
  if (wonHow === 'Solo') return 50
  return 0
}

// ── Types ───────────────────────────────────────────────────────────────────

type RiderResult = {
  rider_id: string
  position: number | null
  dnf: boolean
  abandon_type: string | null
  jersey: string | null
  gc_position_after: number | null
}

type LineupRider = {
  rider_id: string
  role: string
  is_active: boolean
  category: number
  team_name: string
}

type ScoreRow = {
  lineup_id: string
  rider_id: string
  race_id: string
  stage_id: string
  game_id: number
  role: string
  is_bench: boolean
  base_points: number
  role_multiplier: number
  gc_multiplier: number
  role_bonus: number
  jersey_points: number
  team_bonus: number
  bench_penalty: number
  dnf_penalty: number
  calculated_at: string
  // total_points er generated i DB — må ikke insertes
}

// ── Main calculation ────────────────────────────────────────────────────────

export async function calculateCyclingPoints(
  raceId: string,
  stageId: string,
  stageNumber: number,
  gameId: number,
): Promise<void> {
  // 1. Fetch stage profile (falls back to race profile)
  const { data: stage } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, profile, won_how, start_date')
    .eq('id', stageId)
    .single()

  const { data: race } = await supabaseAdmin
    .from('cycling_races')
    .select('id, profile')
    .eq('id', raceId)
    .single()

  if (!race) throw new Error(`Race ${raceId} not found`)
  const profile = stage?.profile ?? race.profile ?? 'mixed'
  const wonHow: string | null = (stage as { won_how?: string | null } | null)?.won_how ?? null

  // 2. Fetch results for this stage
  const { data: resultsRaw } = await supabaseAdmin
    .from('cycling_results')
    .select('rider_id, position, dnf, abandon_type, jersey, gc_position_after')
    .eq('race_id', raceId)
    .eq('stage_number', stageNumber)

  const resultMap = new Map<string, RiderResult>()
  for (const r of resultsRaw ?? []) {
    resultMap.set(r.rider_id, r)
  }

  // 3. Find the winner and their team
  const winner = (resultsRaw ?? []).find((r) => r.position === 1)
  let winnerTeam: string | null = null
  if (winner) {
    const { data: winnerRider } = await supabaseAdmin
      .from('cycling_riders')
      .select('team_name')
      .eq('id', winner.rider_id)
      .single()
    winnerTeam = winnerRider?.team_name ?? null
  }

  // 4. Fetch all lineups for this race + game
  const { data: squads } = await supabaseAdmin
    .from('cycling_squads')
    .select('id, user_id')
    .eq('game_id', gameId)

  if (!squads?.length) return

  const squadIds = squads.map((s) => s.id)

  const { data: lineups } = await supabaseAdmin
    .from('cycling_lineups')
    .select('id, squad_id, race_id, stage_id')
    .eq('stage_id', stageId)
    .in('squad_id', squadIds)

  if (!lineups?.length) return

  // 5. Fetch lineup riders + team_name from cycling_riders (team ændres ikke)
  //    Kategori hentes fra cycling_squad_riders.category_slot (snapshot ved udtagelse)
  const lineupIds = lineups.map((l) => l.id)
  const { data: lineupRidersRaw } = await supabaseAdmin
    .from('cycling_lineup_riders')
    .select(`
      lineup_id, rider_id, role, is_active,
      rider:cycling_riders!inner(id, team_name)
    `)
    .in('lineup_id', lineupIds)

  // Hent effektiv brutto-trup per squad (original + hviledag-transfers anvendt)
  // Effektiv trup for scoring på denne etape = original - outs(før stage) + ins(før stage)
  const stageStartDate = (stage as { start_date?: string } | null)?.start_date ?? '9999-12-31'

  const [{ data: squadCats }, { data: allTransfers }] = await Promise.all([
    supabaseAdmin
      .from('cycling_squad_riders')
      .select('squad_id, rider_id, category_slot')
      .in('squad_id', squadIds),
    supabaseAdmin
      .from('cycling_squad_transfers')
      .select('squad_id, rest_day_date, rider_out_id, rider_in_id, rider_in_category')
      .in('squad_id', squadIds)
      .eq('race_id', raceId),
  ])

  // Map: squad_id → rider_id → category (effektiv efter anvendte transfers)
  const categoryBySquadRider = new Map<string, number>()
  // Map: squad_id → Set af aktive rider_ids i effektiv trup
  const effectiveSquadRiders = new Map<string, Set<string>>()

  for (const sr of squadCats ?? []) {
    const squadId = sr.squad_id as string
    categoryBySquadRider.set(`${squadId}:${sr.rider_id}`, sr.category_slot as number)
    if (!effectiveSquadRiders.has(squadId)) effectiveSquadRiders.set(squadId, new Set())
    effectiveSquadRiders.get(squadId)!.add(sr.rider_id as string)
  }

  for (const t of allTransfers ?? []) {
    const restDay = t.rest_day_date as string
    if (restDay >= stageStartDate) continue  // transfer skete EFTER denne etape
    const squadId = t.squad_id as string
    const outId = t.rider_out_id as string
    const inId = t.rider_in_id as string
    effectiveSquadRiders.get(squadId)?.delete(outId)
    effectiveSquadRiders.get(squadId)?.add(inId)
    categoryBySquadRider.set(`${squadId}:${inId}`, t.rider_in_category as number)
  }

  // Map: lineup_id → squad_id
  const lineupToSquad = new Map<string, string>()
  for (const l of lineups) lineupToSquad.set(l.id, l.squad_id as string)

  // Group by lineup
  const ridersByLineup = new Map<string, LineupRider[]>()
  for (const lr of lineupRidersRaw ?? []) {
    const r = lr.rider as unknown as { id: string; team_name: string }
    const key = String(lr.lineup_id)
    const squadId = lineupToSquad.get(lr.lineup_id as string)
    const snapshotCat = squadId ? categoryBySquadRider.get(`${squadId}:${r.id}`) : undefined

    if (!ridersByLineup.has(key)) ridersByLineup.set(key, [])
    ridersByLineup.get(key)!.push({
      rider_id: r.id,
      role: lr.role,
      is_active: lr.is_active ?? true,
      category: snapshotCat ?? 5, // fallback til kat 5 hvis snapshot mangler
      team_name: r.team_name,
    })
  }

  // 6. Effektiv brutto-trup per squad (bruges til bench penalty)
  const squadRidersBySquad = effectiveSquadRiders

  // Fetch rider details (team) for alle der har været i en effektiv trup
  const allSquadRiderIds = new Set<string>()
  for (const rids of squadRidersBySquad.values()) {
    for (const rid of rids) allSquadRiderIds.add(rid)
  }
  const { data: allRiderDetails } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, category, team_name')
    .in('id', [...allSquadRiderIds])

  const riderDetailMap = new Map<string, { category: number; team_name: string }>()
  for (const rd of allRiderDetails ?? []) {
    riderDetailMap.set(rd.id, { category: rd.category, team_name: rd.team_name })
  }

  const now = new Date().toISOString()
  const allScores: ScoreRow[] = []

  // 7. Calculate points per lineup
  for (const lineup of lineups) {
    const activeRiders = ridersByLineup.get(String(lineup.id)) ?? []
    const activeRiderIds = new Set(activeRiders.map((r) => r.rider_id))

    // Check if leader DNF'd (for lieutenant bonus)
    const leaderRider = activeRiders.find((r) => r.role === 'leader')
    const leaderResult = leaderRider ? resultMap.get(leaderRider.rider_id) : null
    const leaderDnf = leaderResult?.dnf ?? false

    // ── A. Active riders ──────────────────────────────────────
    for (const rider of activeRiders) {
      const result = resultMap.get(rider.rider_id)
      const position = result?.position ?? null
      const isDnf = result?.dnf ?? false
      const isJoker = rider.role === 'joker'

      const catMul = CAT_MULTIPLIER[rider.category] ?? 1.0
      const base = getBasePoints(position)
      const gcMul = getGcMultiplier(result?.gc_position_after ?? null)
      let roleMul = 1.0
      let roleBonus = 0
      let jerseyPts = getJerseyPoints(result?.jersey ?? null)
      let teamBonus = 0
      let dnfPen = 0

      // Role-specific calculation
      switch (rider.role) {
        case 'leader':
          roleMul = catMul
          break

        case 'lieutenant':
          if (position != null && position <= 10) {
            roleMul = catMul * (leaderDnf ? 2.8 : 1.8)
          } else {
            roleMul = catMul
          }
          break

        case 'grimpeur':
          roleMul = catMul * getGrimpeurMultiplier(profile)
          if (wonHow && position != null && position <= 10) {
            roleBonus = getWonHowGrimpeurBonus(wonHow)
          }
          break

        case 'sprinter':
          roleMul = catMul * getSprinterMultiplier(profile)
          if (wonHow && position != null && position <= 10) {
            roleBonus = WON_HOW_SPRINTER_BONUS[wonHow] ?? 0
          }
          break

        case 'domestique':
          roleMul = 1.0 // no multiplier
          if (position != null && position <= 40) {
            const leaderPos = leaderResult?.position
            if (leaderPos != null && leaderPos <= 10) {
              roleBonus = 8
            }
          }
          break

        case 'equipier':
          roleMul = 1.0
          if (winnerTeam && rider.team_name === winnerTeam) {
            roleBonus = 7
          }
          break

        case 'joker':
          roleMul = 1.0
          if (winnerTeam && rider.team_name === winnerTeam) {
            roleBonus = 7
          }
          break

        default:
          roleMul = catMul
          break
      }

      // Team bonus (non-equipier, non-joker)
      if (rider.role !== 'equipier' && rider.role !== 'joker' && rider.role !== 'domestique') {
        if (winnerTeam && rider.team_name === winnerTeam) {
          teamBonus = 5
        }
      }

      // Total for active rider (before DNF) — gc_multiplier stacks oven på role_multiplier
      // for placering-point. Role-bonus, jersey, team_bonus skaleres ikke af GC.
      const rolePoints = (rider.role === 'domestique' || rider.role === 'equipier' || rider.role === 'joker')
        ? base + roleBonus
        : Math.round(base * roleMul * gcMul * 10) / 10 + roleBonus

      // DNF penalty: -50% of would-be score, minimum -5
      if (isDnf && !isJoker) {
        const wouldScore = rolePoints + jerseyPts + teamBonus
        dnfPen = wouldScore > 0
          ? -Math.round(wouldScore * DNF_PENALTY_PCT * 10) / 10
          : DNF_PENALTY_MIN
        dnfPen = Math.min(dnfPen, DNF_PENALTY_MIN)
      }

      allScores.push({
        lineup_id: lineup.id,
        rider_id: rider.rider_id,
        race_id: raceId,
        stage_id: stageId,
        game_id: gameId,
        role: rider.role,
        is_bench: false,
        base_points: base,
        role_multiplier: roleMul,
        gc_multiplier: gcMul,
        role_bonus: roleBonus,
        jersey_points: jerseyPts,
        team_bonus: teamBonus,
        bench_penalty: 0,
        dnf_penalty: dnfPen,
        calculated_at: now,
      })
    }

    // ── B. Bench riders (in squad, not in lineup) ──────────────
    const squad = squads.find((s) => s.id === lineup.squad_id)
    if (!squad) continue

    const allSquadRids = squadRidersBySquad.get(squad.id) ?? new Set()

    for (const riderId of allSquadRids) {
      if (activeRiderIds.has(riderId)) continue // already scored as active

      const result = resultMap.get(riderId)
      if (!result) continue // no result → no penalty

      const riderDetail = riderDetailMap.get(riderId)
      const isJoker = false // bench riders don't have a role assignment for this race
      const position = result.position
      const isDnf = result.dnf

      let benchPen = 0
      let dnfPen = 0

      if (isDnf) {
        dnfPen = DNF_PENALTY_MIN
      }

      if (position != null && !isDnf) {
        // Calculate what they would have scored (base × cat multiplier)
        // Brug snapshot category fra squad (ikke live rating)
        const snapshotCat = categoryBySquadRider.get(`${squad.id}:${riderId}`) ?? riderDetail?.category ?? 5
        const wouldBase = getBasePoints(position)
        const catMul = CAT_MULTIPLIER[snapshotCat] ?? 1.0
        const wouldScore = Math.round(wouldBase * catMul * 10) / 10

        if (position === 1) {
          benchPen = -Math.round(wouldScore * 0.5 * 10) / 10
        } else if (position <= 3) {
          benchPen = -Math.round(wouldScore * 0.4 * 10) / 10
        } else if (position <= 10) {
          benchPen = -Math.round(wouldScore * 0.2 * 10) / 10
        }
      }

      const total = benchPen + dnfPen

      if (total === 0) continue // no penalty → skip

      allScores.push({
        lineup_id: lineup.id,
        rider_id: riderId,
        race_id: raceId,
        stage_id: stageId,
        game_id: gameId,
        role: 'bench',
        is_bench: true,
        base_points: 0,
        role_multiplier: 0,
        gc_multiplier: 1.0,
        role_bonus: 0,
        jersey_points: 0,
        team_bonus: 0,
        bench_penalty: benchPen,
        dnf_penalty: dnfPen,
        calculated_at: now,
      })
    }
  }

  // 8. Upsert all scores
  if (allScores.length > 0) {
    const batchSize = 200
    for (let i = 0; i < allScores.length; i += batchSize) {
      const batch = allScores.slice(i, i + batchSize)
      await supabaseAdmin
        .from('cycling_scores')
        .upsert(batch, { onConflict: 'lineup_id,rider_id,stage_id' })
        .throwOnError()
    }
  }

  // 9. Opdater game_members.earnings — SUM af total_points for alle squads i spillet
  const { data: gameMembers } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', gameId)

  for (const member of gameMembers ?? []) {
    // Find user's squads in this game
    const userSquads = squads.filter((s) => s.user_id === member.user_id)
    const userSquadIds = userSquads.map((s) => s.id)

    if (userSquadIds.length === 0) continue

    // Find lineups for disse squads
    const { data: userLineups } = await supabaseAdmin
      .from('cycling_lineups')
      .select('id')
      .in('squad_id', userSquadIds)

    const userLineupIds = (userLineups ?? []).map((l) => l.id as string)
    if (userLineupIds.length === 0) continue

    // Sum total_points fra cycling_scores
    const { data: userScores } = await supabaseAdmin
      .from('cycling_scores')
      .select('total_points')
      .in('lineup_id', userLineupIds)

    const totalEarnings = (userScores ?? []).reduce(
      (sum, s) => sum + (Number((s as { total_points?: number }).total_points) || 0),
      0
    )

    await supabaseAdmin
      .from('game_members')
      .update({ earnings: Math.round(totalEarnings) })
      .eq('game_id', gameId)
      .eq('user_id', member.user_id)
  }
}

// ── Block status — flip 'active'/'upcoming' → 'finished' når alle løb er kørt
// Idempotent: kalder den fra de samme cron-jobs der beregner points,
// så block_wins begynder at tælle med så snart sidste race er finished.

export async function updateCyclingBlockStatuses(gameId?: number): Promise<number> {
  // Hent kandidat-blocks (ikke allerede finished). Hvis gameId er givet,
  // begræns til det spilrum.
  const blockQuery = supabaseAdmin
    .from('cycling_blocks')
    .select('id, game_id, status')
    .neq('status', 'finished')
  if (gameId != null) blockQuery.eq('game_id', gameId)
  const { data: blocks } = await blockQuery

  if (!blocks?.length) return 0

  const blockIds = blocks.map((b) => b.id as string)

  // Hent alle race-tilknytninger for disse blocks
  const { data: links } = await supabaseAdmin
    .from('cycling_game_races')
    .select('cycling_block_id, race_id')
    .in('cycling_block_id', blockIds)

  const racesByBlock = new Map<string, string[]>()
  for (const l of links ?? []) {
    const bid = l.cycling_block_id as string
    if (!racesByBlock.has(bid)) racesByBlock.set(bid, [])
    racesByBlock.get(bid)!.push(l.race_id as string)
  }

  // Hent status for alle relevante races i ét hug
  const allRaceIds = [...new Set([...racesByBlock.values()].flat())]
  if (allRaceIds.length === 0) return 0

  const { data: races } = await supabaseAdmin
    .from('cycling_races')
    .select('id, status')
    .in('id', allRaceIds)

  const raceStatusMap = new Map<string, string>()
  for (const r of races ?? []) raceStatusMap.set(r.id as string, r.status as string)

  let flipped = 0
  for (const block of blocks) {
    const raceIds = racesByBlock.get(block.id as string) ?? []
    if (raceIds.length === 0) continue
    const allFinished = raceIds.every((rid) => raceStatusMap.get(rid) === 'finished')
    if (!allFinished) continue

    await supabaseAdmin
      .from('cycling_blocks')
      .update({ status: 'finished' })
      .eq('id', block.id)
    flipped++
  }
  return flipped
}

// ── Run for a specific stage across all games ────────────────────────────────

export async function runCyclingPointsForStage(
  stageId: string,
): Promise<void> {
  const { data: stage } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, race_id, stage_number')
    .eq('id', stageId)
    .single()

  if (!stage) throw new Error(`Stage ${stageId} not found`)

  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('game_id')
    .eq('race_id', stage.race_id)

  const gameIds = [...new Set((gameRaces ?? []).map((gr) => gr.game_id))]

  for (const gameId of gameIds) {
    await calculateCyclingPoints(stage.race_id, stageId, stage.stage_number, gameId)
    await updateCyclingBlockStatuses(gameId as number)
  }
}

// ── Legacy wrapper — run all stages for a race across all games ──────────────

export async function runCyclingPointsForAllGames(
  raceId: string,
): Promise<void> {
  const { data: stages } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, stage_number')
    .eq('race_id', raceId)
    .order('stage_number')

  for (const stage of stages ?? []) {
    await runCyclingPointsForStage(stage.id)
  }
}
