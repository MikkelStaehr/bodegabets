/**
 * Helpers til at beregne blok-standings (point pr. bruger) for en cykel-blok.
 *
 * Bruges af:
 *   - updateCyclingBlockStatuses (snapshot ved lukning)
 *   - scripts/backfill-cycling-blocks.ts (historisk backfill)
 *
 * Pure DB-helper — ingen UI eller scoring-logik. Læser fra cycling_scores
 * der allerede er udregnet af calculateCyclingPoints.
 */

import { supabaseAdmin } from '@/lib/supabase'

export type BlockStanding = {
  user_id: string
  points: number
}

/**
 * Beregn standings for en blok i et givet spil.
 *
 * @param gameId       Spilrums-id
 * @param stageMin     Inkl. nedre etape-grænse
 * @param stageMax     Inkl. øvre etape-grænse
 * @param raceIds      Race-id'er der hører til blokken (top-blok = race-links;
 *                     sub-blok = parents race-links)
 *
 * @returns Sorteret liste (mest point først) med summer pr. user_id
 */
export async function computeBlockStandings(
  gameId: number,
  stageMin: number,
  stageMax: number,
  raceIds: string[],
): Promise<BlockStanding[]> {
  if (raceIds.length === 0) return []

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

  // 3. Hent stages der falder i ranget + race-filter
  const { data: stages } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, stage_number, race_id')
    .gte('stage_number', stageMin)
    .lte('stage_number', stageMax)
    .in('race_id', raceIds)
  if (!stages?.length) return []
  const stageIds = stages.map((s) => s.id as string)

  // 4. Sum scores — paginer i tilfælde af mange rækker
  const pointsByUser = new Map<string, number>()
  const lineupIds = [...lineupToUser.keys()]
  if (lineupIds.length === 0) return []

  const PAGE = 1000
  let from = 0
  while (true) {
    const { data: scores, error } = await supabaseAdmin
      .from('cycling_scores')
      .select('lineup_id, total_points')
      .in('lineup_id', lineupIds)
      .in('stage_id', stageIds)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!scores?.length) break
    for (const row of scores) {
      const uid = lineupToUser.get(row.lineup_id as string)
      if (!uid) continue
      pointsByUser.set(uid, (pointsByUser.get(uid) ?? 0) + (Number(row.total_points) || 0))
    }
    if (scores.length < PAGE) break
    from += PAGE
  }

  return [...pointsByUser.entries()]
    .map(([user_id, points]) => ({ user_id, points }))
    .sort((a, b) => b.points - a.points)
}

/**
 * Snapshot standings til cycling_block_results + sæt winner-felter på blok.
 * Idempotent (UPSERT) — kan kaldes flere gange uden duplikering.
 */
export async function snapshotBlockResults(
  blockId: string,
  standings: BlockStanding[],
): Promise<void> {
  if (standings.length === 0) return

  const rows = standings.map((s, idx) => ({
    block_id: blockId,
    user_id: s.user_id,
    rank: idx + 1,
    points: s.points,
  }))

  const { error } = await supabaseAdmin
    .from('cycling_block_results')
    .upsert(rows, { onConflict: 'block_id,user_id' })
  if (error) throw error
}
