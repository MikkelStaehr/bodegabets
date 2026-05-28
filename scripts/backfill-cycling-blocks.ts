/**
 * backfill-cycling-blocks.ts
 *
 * Engangs-script der opdaterer eksisterende cycling_blocks til det nye skema:
 *
 *   1. Populér stage_number_min/max + starts_at/ends_at på alle blokke
 *      (parses fra navnet for sub-blokke, eller fra tilknyttede races for top-blokke)
 *   2. For sub-blokke hvor alle etaper er kørt → markér finished + beregn vinder
 *   3. For top-blokke hvor alle løb er finished → markér finished + beregn vinder
 *   4. Snapshot standings til cycling_block_results
 *
 * Med `--regenerate-subblocks` rør vi også sub-blokke for top-blokke der ikke er
 * begyndt: hvis ranges ikke matcher rest_days, sletter vi eksisterende sub-blokke
 * (kun såfremt INGEN af dem er finished eller har snapshottet historik) og
 * genskaber dem via computeSubBlockRanges. Tour/Vuelta 2026 er typiske kandidater.
 *
 * Idempotent: kan køres flere gange uden duplikering. Eksisterende vinder-rækker
 * i cycling_block_results overskrives ikke (UNIQUE-constraint → ON CONFLICT).
 *
 * Kør: npm run backfill-cycling-blocks
 *      eller med specifikt game-id: npm run backfill-cycling-blocks -- --game 42
 *      eller dry-run: npm run backfill-cycling-blocks -- --dry-run
 *      eller med sub-blok-regen: npm run backfill-cycling-blocks -- --regenerate-subblocks
 */

import { supabaseAdmin } from '../lib/supabase'
import { parseStageRange, computeSubBlockRanges } from '../lib/cyclingBlocks'

type BlockRow = {
  id: string
  game_id: number
  name: string
  block_order: number
  parent_block_id: string | null
  status: string | null
  stage_number_min: number | null
  stage_number_max: number | null
  starts_at: string | null
  ends_at: string | null
  winner_user_id: string | null
  finalized_at: string | null
}

type StageRow = { stage_number: number; start_date: string; results_uploaded_at: string | null; race_id: string }

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const regenerateSubBlocks = args.includes('--regenerate-subblocks')
const gameArgIdx = args.indexOf('--game')
const onlyGameId = gameArgIdx >= 0 ? Number(args[gameArgIdx + 1]) : null

function log(...parts: unknown[]) {
  console.log('[backfill]', ...parts)
}

async function fetchBlocks(): Promise<BlockRow[]> {
  const q = supabaseAdmin
    .from('cycling_blocks')
    .select('id, game_id, name, block_order, parent_block_id, status, stage_number_min, stage_number_max, starts_at, ends_at, winner_user_id, finalized_at')
    .order('game_id, block_order')
  if (onlyGameId != null) q.eq('game_id', onlyGameId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BlockRow[]
}

async function fetchStagesByRace(raceIds: string[]): Promise<Map<string, StageRow[]>> {
  if (raceIds.length === 0) return new Map()
  const { data, error } = await supabaseAdmin
    .from('cycling_stages')
    .select('race_id, stage_number, start_date, results_uploaded_at')
    .in('race_id', raceIds)
    .order('stage_number')
  if (error) throw error
  const map = new Map<string, StageRow[]>()
  for (const row of data ?? []) {
    const rid = row.race_id as string
    if (!map.has(rid)) map.set(rid, [])
    map.get(rid)!.push({
      race_id: rid,
      stage_number: row.stage_number as number,
      start_date: row.start_date as string,
      results_uploaded_at: (row.results_uploaded_at as string | null) ?? null,
    })
  }
  return map
}

async function fetchRaceLinks(blockIds: string[]): Promise<Map<string, string[]>> {
  if (blockIds.length === 0) return new Map()
  const { data, error } = await supabaseAdmin
    .from('cycling_game_races')
    .select('cycling_block_id, race_id')
    .in('cycling_block_id', blockIds)
  if (error) throw error
  const map = new Map<string, string[]>()
  for (const row of data ?? []) {
    const bid = row.cycling_block_id as string
    if (!map.has(bid)) map.set(bid, [])
    map.get(bid)!.push(row.race_id as string)
  }
  return map
}

/** Sum point pr. user_id for et givet game + stage-range. */
async function computeStandings(
  gameId: number,
  stageNumberMin: number,
  stageNumberMax: number,
  raceIds: string[],
): Promise<{ user_id: string; points: number }[]> {
  // 1. Find squads i spillet
  const { data: squads } = await supabaseAdmin
    .from('cycling_squads')
    .select('id, user_id')
    .eq('game_id', gameId)
  if (!squads?.length) return []

  const squadIds = squads.map((s) => s.id as string)
  const userBySquad = new Map<string, string>()
  for (const s of squads) userBySquad.set(s.id as string, s.user_id as string)

  // 2. Find lineups for disse squads
  const { data: lineups } = await supabaseAdmin
    .from('cycling_lineups')
    .select('id, squad_id')
    .in('squad_id', squadIds)
  if (!lineups?.length) return []

  const lineupToUser = new Map<string, string>()
  for (const l of lineups) {
    const uid = userBySquad.get(l.squad_id as string)
    if (uid) lineupToUser.set(l.id as string, uid)
  }

  // 3. Hent stages der falder i ranget + race filter
  const stageQuery = supabaseAdmin
    .from('cycling_stages')
    .select('id, stage_number, race_id')
    .gte('stage_number', stageNumberMin)
    .lte('stage_number', stageNumberMax)
  if (raceIds.length > 0) stageQuery.in('race_id', raceIds)
  const { data: stages } = await stageQuery
  if (!stages?.length) return []
  const stageIds = stages.map((s) => s.id as string)

  // 4. Sum scores
  const pointsByUser = new Map<string, number>()
  const lineupIds = [...lineupToUser.keys()]
  if (lineupIds.length === 0) return []

  // Paginér i tilfælde af mange rækker
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data: scores, error } = await supabaseAdmin
      .from('cycling_scores')
      .select('lineup_id, stage_id, total_points')
      .in('lineup_id', lineupIds)
      .in('stage_id', stageIds)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!scores?.length) break
    for (const row of scores) {
      const uid = lineupToUser.get(row.lineup_id as string)
      if (!uid) continue
      const pts = Number(row.total_points) || 0
      pointsByUser.set(uid, (pointsByUser.get(uid) ?? 0) + pts)
    }
    if (scores.length < PAGE) break
    from += PAGE
  }

  return [...pointsByUser.entries()]
    .map(([user_id, points]) => ({ user_id, points }))
    .sort((a, b) => b.points - a.points)
}

async function snapshotStandings(blockId: string, standings: { user_id: string; points: number }[]) {
  if (standings.length === 0) return
  const rows = standings.map((s, idx) => ({
    block_id: blockId,
    user_id: s.user_id,
    rank: idx + 1,
    points: s.points,
  }))
  if (dryRun) {
    log(`  [dry] ville indsætte ${rows.length} rækker i cycling_block_results`)
    return
  }
  const { error } = await supabaseAdmin
    .from('cycling_block_results')
    .upsert(rows, { onConflict: 'block_id,user_id' })
  if (error) throw error
}

/**
 * Slet og genskab sub-blokke for top-blokke der ikke matcher rest_days.
 * Sikker: kun hvis ingen af de eksisterende sub-blokke er finished eller har
 * snapshottet historik. Køres kun når `--regenerate-subblocks` er sat.
 */
async function regenerateSubBlocksForRaces() {
  log('regenererer sub-blokke fra rest_days …')

  const blocks = await fetchBlocks()
  const topBlocks = blocks.filter((b) => !b.parent_block_id)
  const subByParent = new Map<string, BlockRow[]>()
  for (const b of blocks) {
    if (!b.parent_block_id) continue
    if (!subByParent.has(b.parent_block_id)) subByParent.set(b.parent_block_id, [])
    subByParent.get(b.parent_block_id)!.push(b)
  }

  // Hent rest_days + stages for alle relevante races
  const racesByBlock = await fetchRaceLinks(blocks.map((b) => b.id))
  const allRaceIds = [...new Set([...racesByBlock.values()].flat())]
  const stagesByRace = await fetchStagesByRace(allRaceIds)
  const { data: raceRows } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, rest_days')
    .in('id', allRaceIds)
  const restDaysByRace = new Map<string, string[] | null>()
  for (const r of raceRows ?? []) {
    restDaysByRace.set(r.id as string, (r.rest_days as string[] | null) ?? null)
  }

  let regenerated = 0
  for (const top of topBlocks) {
    const subs = subByParent.get(top.id) ?? []
    if (subs.length === 0) continue

    // Tjek sikkerhed: ingen sub-blok må være finished eller have snapshottet historik
    const anyFinished = subs.some((s) => s.status === 'finished' || s.finalized_at != null)
    if (anyFinished) {
      log(`  skip top-blok ${top.name}: en eller flere sub-blokke er finished`)
      continue
    }
    const subIds = subs.map((s) => s.id)
    const { count: snapshotCount } = await supabaseAdmin
      .from('cycling_block_results')
      .select('id', { count: 'exact', head: true })
      .in('block_id', subIds)
    if ((snapshotCount ?? 0) > 0) {
      log(`  skip top-blok ${top.name}: sub-blokke har historik i cycling_block_results`)
      continue
    }

    // Find race-id'er for denne top-blok (forventer 1 race pr. stage-race)
    const raceIds = racesByBlock.get(top.id) ?? []
    if (raceIds.length === 0) continue
    const raceId = raceIds[0]
    const restDays = restDaysByRace.get(raceId) ?? null
    const stages = stagesByRace.get(raceId) ?? []
    if (stages.length === 0) continue

    // Beregn forventede ranges via samme funktion som generatoren
    const expectedRanges = computeSubBlockRanges(
      stages.map((s) => ({ stage_number: s.stage_number, start_date: s.start_date })),
      restDays,
    )
    if (expectedRanges.length <= 1) {
      log(`  skip top-blok ${top.name}: ingen sub-blokke forventet`)
      continue
    }

    // Sammenlign med eksisterende — hvis identiske, intet at gøre
    const existingSorted = [...subs].sort((a, b) => a.block_order - b.block_order)
    const matches = expectedRanges.length === existingSorted.length && existingSorted.every((sb, i) => {
      const parsed = parseStageRange(sb.name)
      return parsed && parsed.min === expectedRanges[i].range[0] && parsed.max === expectedRanges[i].range[1]
    })
    if (matches) {
      log(`  top-blok ${top.name}: sub-blokke matcher allerede rest_days`)
      continue
    }

    log(`  regenererer sub-blokke for ${top.name}:`)
    log(`    eksisterende: ${existingSorted.map((s) => parseStageRange(s.name) ? `${parseStageRange(s.name)!.min}-${parseStageRange(s.name)!.max}` : '?').join(', ')}`)
    log(`    forventet:    ${expectedRanges.map((r) => `${r.range[0]}-${r.range[1]}`).join(', ')}`)

    if (dryRun) {
      log(`    [dry] ville slette ${existingSorted.length} eksisterende + indsætte ${expectedRanges.length} nye`)
      regenerated++
      continue
    }

    // Slet eksisterende sub-blokke
    const { error: delErr } = await supabaseAdmin.from('cycling_blocks').delete().in('id', subIds)
    if (delErr) throw delErr

    // Find næste block_order til de nye sub-blokke
    const { data: maxOrderRow } = await supabaseAdmin
      .from('cycling_blocks')
      .select('block_order')
      .eq('game_id', top.game_id)
      .order('block_order', { ascending: false })
      .limit(1)
    let nextOrder = ((maxOrderRow?.[0]?.block_order as number | undefined) ?? 0) + 1

    // Hent race-navn til labeling
    const raceName = (raceRows ?? []).find((r) => r.id === raceId)?.name as string

    // Indsæt nye sub-blokke
    for (const range of expectedRanges) {
      const subStages = stages.filter((s) => s.stage_number >= range.range[0] && s.stage_number <= range.range[1])
      if (subStages.length === 0) continue
      const startsAt = subStages[0].start_date
      const endsAt = subStages[subStages.length - 1].start_date
      const deadline = new Date(startsAt)
      deadline.setMinutes(deadline.getMinutes() - 30)

      await supabaseAdmin.from('cycling_blocks').insert({
        game_id: top.game_id,
        name: `${raceName} — ${range.label} (Etape ${range.range[0]}-${range.range[1]})`,
        block_order: nextOrder,
        lock_deadline: deadline.toISOString(),
        parent_block_id: top.id,
        stage_number_min: range.range[0],
        stage_number_max: range.range[1],
        starts_at: startsAt,
        ends_at: endsAt,
      })
      nextOrder++
    }

    regenerated++
  }

  log(`regenererede sub-blokke for ${regenerated} top-blokke`)
}

async function main() {
  log(`start (game=${onlyGameId ?? 'alle'}, dry-run=${dryRun}, regenerate-subblocks=${regenerateSubBlocks})`)

  if (regenerateSubBlocks) {
    await regenerateSubBlocksForRaces()
  }

  const blocks = await fetchBlocks()
  log(`fandt ${blocks.length} blokke`)

  // Hent alle race-links + stages i én forspørgsel
  const allBlockIds = blocks.map((b) => b.id)
  const racesByBlock = await fetchRaceLinks(allBlockIds)
  const allRaceIds = [...new Set([...racesByBlock.values()].flat())]
  const stagesByRace = await fetchStagesByRace(allRaceIds)

  // For sub-blokke har vi ikke direkte race-links — vi går via parent
  const blockById = new Map<string, BlockRow>()
  for (const b of blocks) blockById.set(b.id, b)

  let updated = 0
  let finalized = 0

  for (const block of blocks) {
    const isSubBlock = !!block.parent_block_id
    let stageMin = block.stage_number_min
    let stageMax = block.stage_number_max
    let startsAt = block.starts_at
    let endsAt = block.ends_at

    // ── Find stage-range + relaterede stages ────────────────────────────
    let relatedRaceIds: string[] = []
    if (isSubBlock) {
      // sub-blok → race-ids via parent
      relatedRaceIds = racesByBlock.get(block.parent_block_id!) ?? []
      if (stageMin == null || stageMax == null) {
        const parsed = parseStageRange(block.name)
        if (parsed) {
          stageMin = parsed.min
          stageMax = parsed.max
        }
      }
    } else {
      // top-blok → race-ids direkte
      relatedRaceIds = racesByBlock.get(block.id) ?? []
      if (stageMin == null || stageMax == null) {
        // For stage-races: brug min/max stage_number af alle relaterede races
        const allStages = relatedRaceIds.flatMap((rid) => stagesByRace.get(rid) ?? [])
        if (allStages.length > 0) {
          stageMin = Math.min(...allStages.map((s) => s.stage_number))
          stageMax = Math.max(...allStages.map((s) => s.stage_number))
        }
      }
    }

    // ── Beregn starts_at/ends_at fra de relevante stages ────────────────
    if (startsAt == null || endsAt == null) {
      const allStages = relatedRaceIds.flatMap((rid) => stagesByRace.get(rid) ?? [])
      const inRange = stageMin != null && stageMax != null
        ? allStages.filter((s) => s.stage_number >= stageMin! && s.stage_number <= stageMax!)
        : allStages
      if (inRange.length > 0) {
        const dates = inRange.map((s) => s.start_date).sort()
        startsAt = startsAt ?? dates[0]
        endsAt = endsAt ?? dates[dates.length - 1]
      }
    }

    // ── Persistér metadata-opdatering ───────────────────────────────────
    const patch: Record<string, unknown> = {}
    if (block.stage_number_min == null && stageMin != null) patch.stage_number_min = stageMin
    if (block.stage_number_max == null && stageMax != null) patch.stage_number_max = stageMax
    if (block.starts_at == null && startsAt != null) patch.starts_at = startsAt
    if (block.ends_at == null && endsAt != null) patch.ends_at = endsAt

    if (Object.keys(patch).length > 0) {
      if (dryRun) {
        log(`  [dry] ville opdatere blok ${block.id} (${block.name}):`, patch)
      } else {
        const { error } = await supabaseAdmin.from('cycling_blocks').update(patch).eq('id', block.id)
        if (error) throw error
      }
      updated++
    }

    // ── Hvis blokken kan markeres finished + snapshot vinder ────────────
    if (stageMin == null || stageMax == null) continue
    const allStages = relatedRaceIds.flatMap((rid) => stagesByRace.get(rid) ?? [])
    const inRange = allStages.filter((s) => s.stage_number >= stageMin! && s.stage_number <= stageMax!)
    if (inRange.length === 0) continue
    const allDone = inRange.every((s) => s.results_uploaded_at != null)
    if (!allDone) continue

    // Beregn standings
    const standings = await computeStandings(block.game_id, stageMin, stageMax, relatedRaceIds)
    if (standings.length === 0) continue

    const winner = standings[0]
    const finalizePatch: Record<string, unknown> = {
      status: 'finished',
      winner_user_id: winner.user_id,
      winner_points: winner.points,
      finalized_at: block.finalized_at ?? new Date().toISOString(),
    }

    if (dryRun) {
      log(`  [dry] ville finalisere blok ${block.id} (${block.name}) — vinder ${winner.user_id} med ${winner.points} pt`)
    } else {
      const { error } = await supabaseAdmin.from('cycling_blocks').update(finalizePatch).eq('id', block.id)
      if (error) throw error
    }

    await snapshotStandings(block.id, standings)
    finalized++
  }

  log(`opdateret metadata på ${updated} blokke`)
  log(`finaliseret ${finalized} blokke (vinder snapshottet)`)
  log('færdig')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
