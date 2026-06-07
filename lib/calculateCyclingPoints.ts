// Skema-historik er flyttet til supabase/migrations/. Aktuel total_points-
// formel beregnes af DB som:
//   (base_points * role_multiplier * gc_multiplier)
//     + role_bonus + jersey_points + team_bonus
// Ingen straffe — bench_penalty og dnf_penalty er fjernet i 20260603.

import { supabaseAdmin } from '@/lib/supabase'
import { getBlockStageRange } from '@/lib/cyclingBlocks'
import { computeBlockStandings, snapshotBlockResults } from '@/lib/cyclingBlockStandings'
import {
  CAT_MULTIPLIER,
  GC_MULTIPLIER,
  JERSEY_POINTS,
  NEW_SCORING_FROM,
  WON_HOW_SPRINTER_BONUS,
  getBasePoints,
  getGrimpeurMultiplier,
  getSprinterMultiplier,
  getWonHowGrimpeurBonus,
} from '@/lib/cyclingScoringConstants'

// Konstanterne er nu i lib/cyclingScoringConstants.ts — én kilde til sandhed
// for både scoring og reglebog.

// Trøjebærere for en etape — udledt af klassement-placeringerne (position 1 =
// fører), samme princip som klassement-visningen. Som på vejen bærer hver
// rytter kun ÉN trøje: fører samme rytter flere klassementer, går de lavere
// trøjer videre til næste mand i klassementet. Prioritet: leder > points >
// bjerg > ungdom. En trøje tildeles kun hvis klassementet er registreret (#1 findes).
const JERSEY_CLASSIFICATIONS: Array<{
  jersey: string
  field: 'gc_position_after' | 'points_position_after' | 'mountain_position_after' | 'youth_position_after'
}> = [
  { jersey: 'leader', field: 'gc_position_after' },
  { jersey: 'points', field: 'points_position_after' },
  { jersey: 'mountain', field: 'mountain_position_after' },
  { jersey: 'youth', field: 'youth_position_after' },
]

function computeJerseyWearers(results: RiderResult[]): Map<string, string> {
  const wearers = new Map<string, string>()
  const used = new Set<string>()
  for (const { jersey, field } of JERSEY_CLASSIFICATIONS) {
    if (!results.some((r) => r[field] === 1)) continue // klassement ikke registreret for etapen
    const wearer = results
      .filter((r) => r[field] != null && !used.has(r.rider_id))
      .sort((a, b) => (a[field] as number) - (b[field] as number))[0]
    if (wearer) {
      wearers.set(wearer.rider_id, jersey)
      used.add(wearer.rider_id)
    }
  }
  return wearers
}

function getGcMultiplier(gcPosition: number | null): number {
  if (gcPosition == null) return 1.0
  return GC_MULTIPLIER[gcPosition] ?? 1.0
}

// ── Types ───────────────────────────────────────────────────────────────────

type RiderResult = {
  rider_id: string
  position: number | null
  dnf: boolean
  abandon_type: string | null
  gc_position_after: number | null
  points_position_after: number | null
  mountain_position_after: number | null
  youth_position_after: number | null
  sprint_points: number
  mountain_points: number
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
  // Breakdown af role_multiplier (typisk cat × profile × train). Gemt så
  // UI'en kan vise "hvor kommer multiplikatoren fra" når man hover et point.
  cat_multiplier: number
  profile_multiplier: number
  train_multiplier: number
  role_bonus: number
  jersey_points: number
  team_bonus: number
  intermediate_points: number
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
    .select('rider_id, position, dnf, abandon_type, gc_position_after, points_position_after, mountain_position_after, youth_position_after, sprint_points, mountain_points')
    .eq('race_id', raceId)
    .eq('stage_number', stageNumber)

  const resultMap = new Map<string, RiderResult>()
  for (const r of resultsRaw ?? []) {
    resultMap.set(r.rider_id, r)
  }

  // Trøjebærere for etapen — udledt af klassement-placeringerne i resultaterne
  const jerseyWearers = computeJerseyWearers([...resultMap.values()])

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
  // Nye scoring-regler (spurt-tog + cobbled ×1.2) kun for etaper fra denne dato.
  const newRules = stageStartDate >= NEW_SCORING_FROM

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

  for (const sr of squadCats ?? []) {
    const squadId = sr.squad_id as string
    categoryBySquadRider.set(`${squadId}:${sr.rider_id}`, sr.category_slot as number)
  }

  for (const t of allTransfers ?? []) {
    const restDay = t.rest_day_date as string
    if (restDay >= stageStartDate) continue  // transfer skete EFTER denne etape
    const squadId = t.squad_id as string
    const inId = t.rider_in_id as string
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

  const now = new Date().toISOString()
  const allScores: ScoreRow[] = []

  // 6. Calculate points per lineup
  for (const lineup of lineups) {
    const activeRiders = ridersByLineup.get(String(lineup.id)) ?? []

    // Check if leader DNF'd (for lieutenant bonus)
    const leaderRider = activeRiders.find((r) => r.role === 'leader')
    const leaderResult = leaderRider ? resultMap.get(leaderRider.rider_id) : null
    const leaderDnf = leaderResult?.dnf ?? false

    // Spurt-tog: en spurter forstærkes af equipiers fra SAMME hold (= leadouts).
    // Udløses kun hvis spurteren er top-3. Multiplieren bages ind i spurterens
    // role_multiplier: +0.2 pr. leadout-equipier (cap ×1.4).
    const sprinterRider = activeRiders.find((r) => r.role === 'sprinter')
    const sprinterResult = sprinterRider ? resultMap.get(sprinterRider.rider_id) : null
    const sprinterTop3 = !!sprinterResult && !sprinterResult.dnf && sprinterResult.position != null && sprinterResult.position <= 3
    const leadoutCount = sprinterRider
      ? activeRiders.filter((r) => r.role === 'equipier' && r.team_name === sprinterRider.team_name).length
      : 0
    const trainMul = (newRules && sprinterTop3 && leadoutCount > 0) ? 1 + 0.2 * Math.min(leadoutCount, 2) : 1.0

    // ── A. Active riders ──────────────────────────────────────
    // Ingen minus-point: ryttere der udgår eller placerer sig dårligt får
    // bare 0 placerings-point. DNF og bænk er IKKE straffe — kun fraværende point.
    for (const rider of activeRiders) {
      const result = resultMap.get(rider.rider_id)
      const position = result?.position ?? null

      const catMul = CAT_MULTIPLIER[rider.category] ?? 1.0
      const base = getBasePoints(position)
      const gcMul = getGcMultiplier(result?.gc_position_after ?? null)
      let roleMul = 1.0
      // Breakdown af roleMul — gemmes på score-rækken så tooltip kan vise
      // hvor multiplikatoren kommer fra. Defaults til 1.0 for roller uden
      // multiplikator (domestique/equipier/joker).
      let usedCatMul = 1.0
      let profileMul = 1.0
      let usedTrainMul = 1.0
      let roleBonus = 0
      const jerseyKey = jerseyWearers.get(rider.rider_id)
      const jerseyPts = jerseyKey ? (JERSEY_POINTS[jerseyKey] ?? 0) : 0
      let teamBonus = 0

      // Role-specific calculation
      switch (rider.role) {
        case 'leader':
          usedCatMul = catMul
          roleMul = catMul
          break

        case 'lieutenant':
          usedCatMul = catMul
          if (position != null && position <= 10) {
            profileMul = leaderDnf ? 2.8 : 1.8
            roleMul = catMul * profileMul
          } else {
            roleMul = catMul
          }
          break

        case 'grimpeur':
          usedCatMul = catMul
          profileMul = getGrimpeurMultiplier(profile, newRules)
          roleMul = catMul * profileMul
          if (wonHow && position != null && position <= 10) {
            roleBonus = getWonHowGrimpeurBonus(wonHow)
          }
          break

        case 'sprinter':
          // trainMul = ×1.0 uden tog; ×1.2–1.4 med 1-2 leadout-equipiers fra samme hold
          usedCatMul = catMul
          profileMul = getSprinterMultiplier(profile, newRules)
          usedTrainMul = trainMul
          roleMul = catMul * profileMul * trainMul
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
          usedCatMul = catMul
          roleMul = catMul
          break
      }

      // Team bonus (non-equipier, non-joker)
      if (rider.role !== 'equipier' && rider.role !== 'joker' && rider.role !== 'domestique') {
        if (winnerTeam && rider.team_name === winnerTeam) {
          teamBonus = 5
        }
      }

      // total_points er en generated kolonne i DB; den beregnes automatisk fra
      // base_points * role_multiplier * gc_multiplier + bonusser. Vi indsætter
      // bare komponenterne.

      // Sprint + KOM-points scoret på ETAPEN — 1:1 oveni resten af scoring,
      // alle roller får dem hvis deres rytter har dem. Bevidst uden multiplier
      // så feedback er forudsigelig ("PCS siger 15 = jeg får 15").
      const intermediatePoints = (result?.sprint_points ?? 0) + (result?.mountain_points ?? 0)

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
        cat_multiplier: usedCatMul,
        profile_multiplier: profileMul,
        train_multiplier: usedTrainMul,
        role_bonus: roleBonus,
        jersey_points: jerseyPts,
        team_bonus: teamBonus,
        intermediate_points: intermediatePoints,
        calculated_at: now,
      })
    }

    // ── B. Bænk-ryttere: ingen point ───────────────────────────
    // Ryttere på bænken giver hverken plus eller minus — de er helt
    // udeladt af scoringen, uanset placering eller DNF. Eksisterende
    // bænk-rækker ryddes i trin 7 før upsert, så gamle penalties
    // forsvinder ved genberegning.
  }

  // 7. Ryd gamle bænk-scores for denne etape/spil — bænk-ryttere giver
  //    hverken plus eller minus, og upsert sletter ikke forældede rækker.
  await supabaseAdmin
    .from('cycling_scores')
    .delete()
    .eq('stage_id', stageId)
    .eq('game_id', gameId)
    .eq('is_bench', true)
    .throwOnError()

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

// ── Block lifecycle — upcoming → active → finished ─────────────────────────
//
// Kører fuld status-cyclus for alle blokke i et spil (eller alle spil).
// Idempotent: trygt at kalde flere gange. Auto-finalize ved overgang til
// 'finished' — beregner standings og snapshotter til cycling_block_results +
// sætter winner_user_id/winner_points/finalized_at på blokken.
//
// Status-regler:
//   upcoming → active:   første relevante etape har results_uploaded_at
//   active → finished:   alle relevante etaper har results_uploaded_at
//     - top-blok: alle etaper på tværs af alle tilknyttede races
//     - sub-blok: alle etaper i stage_number-rangen for parent-races
//   no-change:           hvis intet er ændret (idempotent)

type BlockStatusRow = {
  id: string
  game_id: number
  status: string
  name: string
  parent_block_id: string | null
  stage_number_min: number | null
  stage_number_max: number | null
  winner_user_id: string | null
  finalized_at: string | null
}

export async function updateCyclingBlockStatuses(gameId?: number): Promise<number> {
  // Hent ALLE blokke (også finished — så vi kan reparere snapshots der mangler).
  // Vi springer kun rene no-op-blokke over i selve flip-trinet.
  const blockQuery = supabaseAdmin
    .from('cycling_blocks')
    .select('id, game_id, status, name, parent_block_id, stage_number_min, stage_number_max, winner_user_id, finalized_at')
  if (gameId != null) blockQuery.eq('game_id', gameId)
  const { data: blocksRaw } = await blockQuery
  if (!blocksRaw?.length) return 0

  const blocks = blocksRaw as BlockStatusRow[]
  const blockIds = blocks.map((b) => b.id)

  // Race-links pr. blok (kun top-blokke har direkte links)
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

  // Etaper for alle relevante races (sub-blokkes parent-races inkluderet)
  const parentRaceMap = new Map<string, string[]>()
  for (const b of blocks) {
    if (!b.parent_block_id) continue
    const parentRaces = racesByBlock.get(b.parent_block_id) ?? []
    parentRaceMap.set(b.id, parentRaces)
  }
  const allRaceIds = [...new Set([
    ...racesByBlock.values(),
    ...parentRaceMap.values(),
  ].flat())]
  if (allRaceIds.length === 0) return 0

  const { data: stages } = await supabaseAdmin
    .from('cycling_stages')
    .select('race_id, stage_number, results_uploaded_at')
    .in('race_id', allRaceIds)
  const stagesByRace = new Map<string, { stage_number: number; results_uploaded_at: string | null }[]>()
  for (const s of stages ?? []) {
    const rid = s.race_id as string
    if (!stagesByRace.has(rid)) stagesByRace.set(rid, [])
    stagesByRace.get(rid)!.push({
      stage_number: s.stage_number as number,
      results_uploaded_at: (s.results_uploaded_at as string | null) ?? null,
    })
  }

  // Hjælper: beregn ny status + relateret race-ids for blokken
  function evaluateBlock(block: BlockStatusRow): {
    expected: 'upcoming' | 'active' | 'finished'
    raceIds: string[]
    relevantStages: { stage_number: number; results_uploaded_at: string | null }[]
  } | null {
    const isSubBlock = !!block.parent_block_id
    const raceIds = isSubBlock
      ? (parentRaceMap.get(block.id) ?? [])
      : (racesByBlock.get(block.id) ?? [])
    if (raceIds.length === 0) return null

    const allStages = raceIds.flatMap((rid) => stagesByRace.get(rid) ?? [])
    const range = isSubBlock
      ? getBlockStageRange(block)
      : (block.stage_number_min != null && block.stage_number_max != null
          ? { min: block.stage_number_min, max: block.stage_number_max }
          : null)
    const relevantStages = range
      ? allStages.filter((s) => s.stage_number >= range.min && s.stage_number <= range.max)
      : allStages
    if (relevantStages.length === 0) return null

    const uploaded = relevantStages.filter((s) => s.results_uploaded_at != null)
    if (uploaded.length === 0) return { expected: 'upcoming', raceIds, relevantStages }
    if (uploaded.length === relevantStages.length) return { expected: 'finished', raceIds, relevantStages }
    return { expected: 'active', raceIds, relevantStages }
  }

  let flipped = 0
  for (const block of blocks) {
    const evalResult = evaluateBlock(block)
    if (!evalResult) continue
    const { expected, raceIds } = evalResult

    const currentStatus = block.status ?? 'upcoming'
    const statusChanged = currentStatus !== expected
    const needsFinalize = expected === 'finished' &&
      (block.winner_user_id == null || block.finalized_at == null)

    if (!statusChanged && !needsFinalize) continue

    // Beregn nyt patch
    const patch: Record<string, unknown> = {}
    if (statusChanged) patch.status = expected

    // Auto-finalize ved overgang til finished (eller hvis snapshot mangler)
    if (expected === 'finished' && needsFinalize) {
      const stageMin = block.stage_number_min ?? evalResult.relevantStages[0]?.stage_number
      const stageMax = block.stage_number_max ?? evalResult.relevantStages[evalResult.relevantStages.length - 1]?.stage_number
      if (stageMin != null && stageMax != null) {
        const standings = await computeBlockStandings(block.game_id, stageMin, stageMax, raceIds)
        if (standings.length > 0) {
          const winner = standings[0]
          patch.winner_user_id = winner.user_id
          patch.winner_points = winner.points
          patch.finalized_at = new Date().toISOString()
          await snapshotBlockResults(block.id, standings)
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from('cycling_blocks').update(patch).eq('id', block.id)
      flipped++
    }
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
