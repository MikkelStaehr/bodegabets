/**
 * cyclingSquadLimits.ts — beregner reelle squad-grænser per blok.
 *
 * Standard-reglerne (max 3 kat 1, 5 kat 2 osv. → 25 totalt) antager at
 * en stor pulje af ryttere er tilgængelig (typisk Tour de France niveau).
 * Mindre løb som Tour de Romandie har færre top-ryttere på startlisten,
 * så grænsen pr. kategori og total må reduceres tilsvarende.
 *
 * Formel: limit[cat] = min(default[cat], available_in_block_startlists[cat])
 *         maxTotal   = min(25, sum(limit[1..5]))
 */

import { supabaseAdmin } from '@/lib/supabase'

export const DEFAULT_CAT_LIMITS: Record<number, number> = { 1: 3, 2: 5, 3: 5, 4: 5, 5: 7 }
export const DEFAULT_MAX_TOTAL = 25
export const MAX_PER_TEAM = 3

export type SquadLimits = {
  catLimits: Record<number, number>
  maxTotal: number
  maxPerTeam: number
  /** True hvis grænserne er reduceret pga. begrænset startliste */
  constrained: boolean
}

export async function computeBlockSquadLimits(
  blockRaceIds: string[],
): Promise<SquadLimits> {
  const fallback: SquadLimits = {
    catLimits: { ...DEFAULT_CAT_LIMITS },
    maxTotal: DEFAULT_MAX_TOTAL,
    maxPerTeam: MAX_PER_TEAM,
    constrained: false,
  }

  if (blockRaceIds.length === 0) return fallback

  const { data: startlists } = await supabaseAdmin
    .from('cycling_startlists')
    .select('rider_id')
    .in('race_id', blockRaceIds)

  if (!startlists?.length) return fallback

  const uniqueRiderIds = [...new Set(startlists.map((s) => s.rider_id as string))]

  const { data: riders } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, category')
    .in('id', uniqueRiderIds)

  const catCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of riders ?? []) {
    const cat = r.category as number
    if (cat >= 1 && cat <= 5) catCounts[cat]++
  }

  const catLimits: Record<number, number> = {}
  let summed = 0
  let constrained = false
  for (const [catStr, defaultLimit] of Object.entries(DEFAULT_CAT_LIMITS)) {
    const cat = Number(catStr)
    const avail = catCounts[cat] ?? 0
    const limit = Math.min(defaultLimit, avail)
    if (limit < defaultLimit) constrained = true
    catLimits[cat] = limit
    summed += limit
  }

  const maxTotal = Math.min(DEFAULT_MAX_TOTAL, summed)
  if (maxTotal < DEFAULT_MAX_TOTAL) constrained = true

  return { catLimits, maxTotal, maxPerTeam: MAX_PER_TEAM, constrained }
}
