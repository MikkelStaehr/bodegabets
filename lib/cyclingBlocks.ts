/**
 * Helpers til cykel-blok-systemet (især sub-blokke = uger i et stage race).
 *
 * Sub-blokkenes stage-range gemmes i navnet, fx
 *   "Giro d'Italia — Uge 1 (Etape 1-9)"
 * Vi parser det her indtil vi evt. tilføjer eksplicitte
 * stage_number_min/max kolonner på cycling_blocks.
 */

export type StageRange = { min: number; max: number }

/** Parse stage_number-range fra et sub-blok-navn. Returnerer null hvis ikke fundet. */
export function parseStageRange(blockName: string | null | undefined): StageRange | null {
  if (!blockName) return null
  const m = blockName.match(/Etape\s+(\d+)\s*-\s*(\d+)/i)
  if (!m) return null
  const min = Number(m[1])
  const max = Number(m[2])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null
  return { min, max }
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
export function findActiveSubBlock<B extends { id: string; name: string; block_order: number }>(
  subBlocks: B[],
  stages: { stage_number: number; results_uploaded_at: string | null }[],
): B | null {
  if (subBlocks.length === 0) return null
  const sorted = [...subBlocks].sort((a, b) => a.block_order - b.block_order)
  for (const sb of sorted) {
    const range = parseStageRange(sb.name)
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
