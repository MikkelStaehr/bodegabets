/**
 * Helpers til cykel-blok-systemet (især sub-blokke = uger i et stage race).
 *
 * Stage-vinduet er nu eksplicit gemt som `stage_number_min/max` på
 * cycling_blocks. For bagudkompatibilitet kan vi stadig parse fra
 * navnet ("(Etape A-B)") indtil alle gamle blokke er backfillet.
 */

export type StageRange = { min: number; max: number }

/** Parse stage-range fra et sub-blok-navn (legacy fallback). */
export function parseStageRange(blockName: string | null | undefined): StageRange | null {
  if (!blockName) return null
  const m = blockName.match(/Etape\s+(\d+)\s*-\s*(\d+)/i)
  if (!m) return null
  const min = Number(m[1])
  const max = Number(m[2])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null
  return { min, max }
}

/**
 * Læs stage-range fra blok: foretrækker eksplicitte kolonner, falder
 * tilbage til at parse navnet for blokke der ikke er backfillet endnu.
 */
export function getBlockStageRange(
  block: { name?: string | null; stage_number_min?: number | null; stage_number_max?: number | null },
): StageRange | null {
  const min = block.stage_number_min
  const max = block.stage_number_max
  if (typeof min === 'number' && typeof max === 'number' && min <= max) {
    return { min, max }
  }
  return parseStageRange(block.name)
}

/** En sub-blok er "færdig" når alle dens etaper har resultater. */
export function isSubBlockFinished(
  range: StageRange,
  stages: { stage_number: number; results_uploaded_at: string | null }[],
): boolean {
  const inRange = stages.filter((s) => s.stage_number >= range.min && s.stage_number <= range.max)
  if (inRange.length === 0) return false
  return inRange.every((s) => s.results_uploaded_at != null)
}

/**
 * Find den aktive sub-blok: laveste block_order der ikke er færdig.
 * Hvis alle er færdige → den sidste (så standings stadig vises efter løbet).
 */
export function findActiveSubBlock<
  B extends {
    id: string
    name: string
    block_order: number
    stage_number_min?: number | null
    stage_number_max?: number | null
  },
>(
  subBlocks: B[],
  stages: { stage_number: number; results_uploaded_at: string | null }[],
): B | null {
  if (subBlocks.length === 0) return null
  const sorted = [...subBlocks].sort((a, b) => a.block_order - b.block_order)
  for (const sb of sorted) {
    const range = getBlockStageRange(sb)
    if (!range) continue
    if (!isSubBlockFinished(range, stages)) return sb
  }
  return sorted[sorted.length - 1]
}

/** Vis-navn for en sub-blok: strip "(Etape X-Y)"-suffikset til en kortere form. */
export function shortSubBlockName(name: string): string {
  // "Giro d'Italia — Uge 1 (Etape 1-9)" → "Giro d'Italia — Uge 1"
  return name.replace(/\s*\(Etape\s+\d+\s*-\s*\d+\)\s*$/i, '').trim()
}

/**
 * Beregn sub-blok-grænser ud fra hviledage.
 *
 * `restDays` er ISO-datoer (cycling_races.rest_days date[]). For hver hviledag
 * splitter vi etaperne: den sidste etape FØR hviledagen lukker en uge, den
 * første etape EFTER starter den næste.
 *
 * Returnerer en liste af [min, max]-ranges (inkl.) — én pr. uge.
 * Hvis ingen hviledage findes → fald tilbage til "3 lige uger" baseret på
 * antal etaper (bagudkompatibilitet for løb hvor rest_days mangler i DB).
 *
 * Pure function — ingen DB-kald — så den kan bruges fra både server-runtime
 * og engangs-scripts uden at trække supabaseAdmin-klienten med.
 */
export function computeSubBlockRanges(
  stages: { stage_number: number; start_date: string }[],
  restDays: string[] | null,
): { label: string; range: [number, number] }[] {
  const sorted = [...stages].sort((a, b) => a.stage_number - b.stage_number)
  if (sorted.length === 0) return []

  const minStage = sorted[0].stage_number
  const maxStage = sorted[sorted.length - 1].stage_number

  // Med rest_days: split ved hver hviledag
  if (restDays && restDays.length > 0) {
    const restSet = new Set(restDays.map((d) => d.slice(0, 10)))
    const cutoffs: number[] = []
    for (const rest of [...restSet].sort()) {
      const before = sorted.filter((s) => s.start_date.slice(0, 10) < rest)
      if (before.length === 0) continue
      const lastBefore = before[before.length - 1].stage_number
      if (!cutoffs.includes(lastBefore)) cutoffs.push(lastBefore)
    }
    cutoffs.sort((a, b) => a - b)

    const ranges: { label: string; range: [number, number] }[] = []
    let cursor = minStage
    let idx = 1
    for (const cut of cutoffs) {
      if (cut < cursor) continue
      ranges.push({ label: `Uge ${idx}`, range: [cursor, cut] })
      cursor = cut + 1
      idx++
    }
    if (cursor <= maxStage) {
      ranges.push({ label: `Uge ${idx}`, range: [cursor, maxStage] })
    }

    if (ranges.length >= 2) return ranges
  }

  // Fallback: 3 lige uger over [minStage, maxStage]
  const totalStages = maxStage - minStage + 1
  if (totalStages < 4) {
    return [{ label: 'Uge 1', range: [minStage, maxStage] }]
  }
  const a = Math.ceil(totalStages / 3)
  const b = Math.ceil(((totalStages - a) / 2))
  const week1End = minStage + a - 1
  const week2End = week1End + b
  return [
    { label: 'Uge 1', range: [minStage, week1End] },
    { label: 'Uge 2', range: [week1End + 1, week2End] },
    { label: 'Uge 3', range: [week2End + 1, maxStage] },
  ]
}
