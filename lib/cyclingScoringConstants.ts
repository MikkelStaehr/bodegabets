/**
 * Centraliserede scoring-konstanter for cykling.
 *
 * Én kilde til sandhed for både beregning (lib/calculateCyclingPoints.ts) og
 * reglebogen (app/games/cycling-guide). Hvis du ændrer point/multipliers her,
 * opdateres både scoring og reglebog automatisk.
 *
 * Pure module — ingen DB-kald, ingen side-effects.
 */

// ── Basispoint (placering) ─────────────────────────────────────────────────

export const POSITION_POINTS: [number, number][] = [
  [1, 50],
  [3, 30],
  [5, 20],
  [10, 10],
  [20, 5],
]

export function getBasePoints(position: number | null): number {
  if (position == null || position <= 0) return 0
  for (const [maxPos, pts] of POSITION_POINTS) {
    if (position <= maxPos) return pts
  }
  return 0
}

// ── TTT holdrang → point ───────────────────────────────────────────────────
// På holdtempo scores efter HOLDETS placering (alle ryttere på holdet får
// samme). Egen finere skala end den individuelle, så hver holdplacering tæller
// (1. og 2. hold skal ikke have det samme). Legacy-TTT halveres oveni (×0.5).
const TTT_TEAM_POINTS: [number, number][] = [
  [1, 50], [2, 40], [3, 30], [4, 22], [5, 16], [6, 12], [10, 8], [15, 4],
]

export function getTttTeamPoints(teamRank: number | null): number {
  if (teamRank == null || teamRank <= 0) return 0
  for (const [maxRank, pts] of TTT_TEAM_POINTS) {
    if (teamRank <= maxRank) return pts
  }
  return 0
}

/** Vis-version til reglebog. */
export const TTT_TEAM_POINTS_DISPLAY: { label: string; value: number }[] = [
  { label: '1. hold', value: 50 },
  { label: '2. hold', value: 40 },
  { label: '3. hold', value: 30 },
  { label: '4. hold', value: 22 },
  { label: '5. hold', value: 16 },
  { label: '6. hold', value: 12 },
  { label: '7.-10. hold', value: 8 },
  { label: '11.-15. hold', value: 4 },
]

/** Vis-version af basispoint-tabellen til reglebog. */
export const POSITION_POINTS_DISPLAY: { label: string; value: number }[] = [
  { label: '1. plads', value: 50 },
  { label: '2.-3. plads', value: 30 },
  { label: '4.-5. plads', value: 20 },
  { label: '6.-10. plads', value: 10 },
  { label: '11.-20. plads', value: 5 },
]

// ── Kategori-multiplikator ─────────────────────────────────────────────────

export const CAT_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 1.3,
  3: 1.7,
  4: 2.2,
  5: 3.5,
}

export const CAT_LABELS: Record<number, string> = {
  1: 'Topstjerner',
  2: 'Stjerner',
  3: 'Outsidere',
  4: 'Holdarbejdere',
  5: 'Outsidere++',
}

// ── Jersey-point (kun stage races) ─────────────────────────────────────────

export const JERSEY_POINTS: Record<string, number> = {
  leader: 8,
  points: 5,
  mountain: 5,
  youth: 3,
}

export const JERSEY_LABELS: Record<string, string> = {
  leader: 'Førertrøje (sammenlagt)',
  points: 'Pointtrøje (sprint)',
  mountain: 'Bjergtrøje',
  youth: 'Ungdomstrøje',
}

// ── GC-multiplikator (top-10 sammenlagt) ───────────────────────────────────

export const GC_MULTIPLIER: Record<number, number> = {
  1: 1.4,
  2: 1.3, 3: 1.3,
  4: 1.2, 5: 1.2,
  6: 1.1, 7: 1.1, 8: 1.1, 9: 1.1, 10: 1.1,
}

export function getGcMultiplier(gcPosition: number | null): number {
  if (gcPosition == null) return 1.0
  return GC_MULTIPLIER[gcPosition] ?? 1.0
}

export const GC_MULTIPLIER_DISPLAY: { label: string; value: string }[] = [
  { label: 'Sammenlagt #1', value: '×1.4' },
  { label: 'Sammenlagt #2-3', value: '×1.3' },
  { label: 'Sammenlagt #4-5', value: '×1.2' },
  { label: 'Sammenlagt #6-10', value: '×1.1' },
  { label: 'Sammenlagt #11+', value: '×1.0' },
]

// Ingen minus-point: vi har ingen DNF-straf, ingen bænk-straf og ingen
// andre fradrag. En rytter der udgår eller placerer sig dårligt får
// bare 0 placerings-point, men ikke negative point.

// ── Spurt-tog ──────────────────────────────────────────────────────────────

export const TRAIN_BONUS_PER_LEADOUT = 0.2  // +20% pr. leadout-equipier
export const TRAIN_MAX_LEADOUTS = 2          // cap ved 2 (×1.4 max)

/** Spurt-tog-multiplier baseret på antal leadout-equipiers. */
export function computeTrainMultiplier(leadoutCount: number, sprinterTop3: boolean, newRules: boolean): number {
  if (!newRules || !sprinterTop3 || leadoutCount <= 0) return 1.0
  return 1 + TRAIN_BONUS_PER_LEADOUT * Math.min(leadoutCount, TRAIN_MAX_LEADOUTS)
}

// ── Profile-baserede rolle-multipliers ─────────────────────────────────────

// cobbled (brosten) behandles som 'hilly' (bakket) ×1.2 under nye regler.
// Før NEW_SCORING_FROM gav cobbled ×1.0 (uændret bagud).

export function getGrimpeurMultiplier(profile: string, newRules: boolean): number {
  if (profile === 'mountain') return 1.8
  if (profile === 'hilly') return 1.2
  if (profile === 'cobbled') return newRules ? 1.2 : 1.0
  return 1.0
}

export function getSprinterMultiplier(profile: string, newRules: boolean): number {
  if (profile === 'flat' || profile === 'mixed') return 1.8
  if (profile === 'hilly') return 1.2
  if (profile === 'cobbled') return newRules ? 1.2 : 1.0
  return 1.0
}

export const LIEUTENANT_MULTIPLIER_NORMAL = 1.8
export const LIEUTENANT_MULTIPLIER_LEADER_DNF = 2.8

// ── Won-how bonuses ────────────────────────────────────────────────────────

export const WON_HOW_SPRINTER_BONUS: Record<string, number> = {
  'Bunch sprint': 20,
  'Small group sprint': 25,
  'Sprint a deux': 50,
}

export function getWonHowGrimpeurBonus(wonHow: string): number {
  if (wonHow === 'Sprint a deux') return 25
  if (wonHow === 'Small group sprint') return 20
  const soloMatch = wonHow.match(/^([\d.]+)\s*km\s+solo$/i)
  if (soloMatch) return 50 + Math.floor(parseFloat(soloMatch[1]))
  if (wonHow === 'Solo') return 50
  return 0
}

// ── Bonusser ───────────────────────────────────────────────────────────────

export const TEAM_BONUS_DEFAULT = 5      // Leader/Lieutenant/Grimpeur/Sprinter på vinderhold
export const EQUIPIER_TEAM_BONUS = 7     // Equipier/Joker på vinderhold
export const DOMESTIQUE_BONUS = 8        // Domestique top-40 hvis Leader top-10

// ── New scoring gate ───────────────────────────────────────────────────────

export const NEW_SCORING_FROM = '2026-05-27'

// TTT-overgang: den dedikerede TTT-lineup-form (rolle-løs, max 6 ryttere, max
// 2 pr. hold) blev deployet 2026-06-09 EFTER at Dauphiné etape 3's lineups var
// låst. Den etape blev sat under den gamle form (op til 8 ryttere, intet
// hold-loft), så fuld flad holdscore ville give oppustede haul (en der
// stackede 4-5 vinderholds-ryttere = 200-250). TTT-etaper FØR denne dato
// halveres derfor (×0.5) — det får legacy-loftet (~4 ryttere × 25 = 100) til
// at matche den nye models loft (2 × 50 = 100). Etaper fra denne dato og frem
// bygges under den nye form og scores med fuld flad model.
export const TTT_FULL_FROM = '2026-06-10'

// ── Rolle-konstanter ───────────────────────────────────────────────────────

export type CyclingRoleKey =
  | 'leader' | 'lieutenant' | 'grimpeur' | 'sprinter'
  | 'domestique' | 'equipier' | 'joker'

export const ROLE_CATEGORIES: Record<CyclingRoleKey, string> = {
  leader: 'Alle kategorier',
  lieutenant: 'Kategori 2–3',
  grimpeur: 'Kategori 3–5',
  sprinter: 'Kategori 1–3',
  domestique: 'Kun kategori 4',
  equipier: 'Alle kategorier',
  joker: 'Alle kategorier',
}

// ── Won-how visnings-værdier ────────────────────────────────────────────────

export const WON_HOW_LABELS: Record<string, string> = {
  'Bunch sprint': 'Massespurt',
  'Small group sprint': 'Lille gruppe-spurt',
  'Sprint a deux': 'Spurt à deux',
  'Solo': 'Solo',
}
