/**
 * cyclingSandboxScoring.ts — REN scoring-motor til det skjulte /lab-sandbox.
 *
 * Spejler produktionsformlerne i lib/calculateCyclingPoints.ts (POSITION_POINTS,
 * kategori- og rolle-multipliers, won_how-bonusser, DNF, lieutenant/domestique-
 * synergi) PLUS et EKSPERIMENTELT "spurt-tog"-synergi-lag, så vi kan teste om
 * rollerne komplementerer hinanden. Produktionsscoringen er UÆNDRET — den her
 * bruges kun til at jamme/tune.
 *
 * Forenklinger ift. produktion (bevidst, for at fokusere på rolle-synergi):
 * GC-multiplier, trøjepoint og hold-bonus er udeladt.
 */

export type Profile = 'flat' | 'hilly' | 'mountain' | 'mixed'
export type WonHow = 'none' | 'bunch' | 'small_group' | 'sprint_a_deux' | 'solo'
export type Role =
  | 'leader' | 'lieutenant' | 'grimpeur' | 'sprinter'
  | 'domestique' | 'leadout' | 'equipier' | 'joker'

export type SandboxRider = {
  id: string
  role: Role
  category: number // 1-5
  position: number | null // mål-placering; null = ikke i resultatet
  dnf: boolean
}

export type RiderBreakdown = {
  base: number
  roleMul: number
  roleBonus: number
  synergy: number
  dnfPen: number
  total: number
  notes: string[]
}

// ── Produktions-tabeller (spejlet fra calculateCyclingPoints.ts) ─────────────
const POSITION_POINTS: [number, number][] = [[1, 50], [3, 30], [5, 20], [10, 10], [20, 5]]
const CAT_MULTIPLIER: Record<number, number> = { 1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 3.5 }
const SPRINT_WON_HOW: Record<WonHow, number> = { none: 0, bunch: 20, small_group: 25, sprint_a_deux: 50, solo: 0 }
const GRIMP_WON_HOW: Record<WonHow, number> = { none: 0, bunch: 0, small_group: 20, sprint_a_deux: 25, solo: 50 }

// ── Eksperimentelle tog-parametre (det vi vil tune) ──────────────────────────
export const TRAIN = {
  perLeadoutMult: 0.2,   // spurter ×(1 + 0.2 × antal leadout)
  maxLeadouts: 2,        // cap på antal leadout der tæller
  leadoutBonus: 10,      // leadout: +10 hvis top-40 OG spurter top-3 (à la domestik)
  leadoutTop: 40,        // placerings-grænse for leadout-bonus
}

function basePoints(pos: number | null): number {
  if (pos == null || pos <= 0) return 0
  for (const [maxPos, pts] of POSITION_POINTS) if (pos <= maxPos) return pts
  return 0
}
function grimpeurMul(p: Profile): number { return p === 'mountain' ? 1.8 : p === 'hilly' ? 1.2 : 1.0 }
function sprinterMul(p: Profile): number { return (p === 'flat' || p === 'mixed') ? 1.8 : p === 'hilly' ? 1.2 : 1.0 }
const round1 = (n: number) => Math.round(n * 10) / 10

const FLAT_ROLES: Role[] = ['domestique', 'leadout', 'equipier', 'joker']

export type LineupScore = {
  rows: Array<SandboxRider & { bd: RiderBreakdown }>
  total: number
  trainActive: boolean
  trainMul: number
}

export function scoreLineup(
  riders: SandboxRider[],
  profile: Profile,
  wonHow: WonHow,
  useTrainSynergy: boolean,
): LineupScore {
  const leader = riders.find((r) => r.role === 'leader')
  const leaderDnf = leader?.dnf ?? false
  const leaderPos = leader?.position ?? null

  const sprinter = riders.find((r) => r.role === 'sprinter')
  const leadouts = riders.filter((r) => r.role === 'leadout')
  const sprinterPos = sprinter && !sprinter.dnf ? sprinter.position : null
  const sprinterTop3 = sprinterPos != null && sprinterPos <= 3
  const trainActive = useTrainSynergy && sprinterTop3 && leadouts.length > 0
  const trainMul = trainActive ? 1 + TRAIN.perLeadoutMult * Math.min(leadouts.length, TRAIN.maxLeadouts) : 1

  const rows = riders.map((r) => {
    const catMul = CAT_MULTIPLIER[r.category] ?? 1.0
    const base = basePoints(r.position)
    const pos = r.position
    let roleMul = 1.0
    let roleBonus = 0
    let synergy = 0
    let dnfPen = 0
    const notes: string[] = []

    switch (r.role) {
      case 'leader':
        roleMul = catMul
        break
      case 'lieutenant':
        if (pos != null && pos <= 10) {
          roleMul = catMul * (leaderDnf ? 2.8 : 1.8)
          notes.push(leaderDnf ? '×2.8 — leder udgået' : '×1.8 — top-10')
        } else roleMul = catMul
        break
      case 'grimpeur':
        roleMul = catMul * grimpeurMul(profile)
        if (pos != null && pos <= 10 && GRIMP_WON_HOW[wonHow]) {
          roleBonus = GRIMP_WON_HOW[wonHow]
          notes.push(`+${roleBonus} won-how`)
        }
        break
      case 'sprinter':
        roleMul = catMul * sprinterMul(profile)
        if (pos != null && pos <= 10 && SPRINT_WON_HOW[wonHow]) {
          roleBonus = SPRINT_WON_HOW[wonHow]
          notes.push(`+${roleBonus} won-how`)
        }
        break
      case 'domestique':
        if (pos != null && pos <= 40 && leaderPos != null && leaderPos <= 10 && !leaderDnf) {
          roleBonus = 8
          notes.push('+8 — leder top-10')
        }
        break
      case 'leadout':
        // Spurt-tvilling af domestik: +bonus hvis selv top-40 OG spurter top-3
        if (useTrainSynergy && pos != null && pos <= TRAIN.leadoutTop && sprinterTop3) {
          roleBonus = TRAIN.leadoutBonus
          notes.push(`+${TRAIN.leadoutBonus} — top-${TRAIN.leadoutTop} + spurter top-3`)
        }
        break
      case 'equipier':
      case 'joker':
        break
    }

    const isFlat = FLAT_ROLES.includes(r.role)
    const rolePoints = isFlat ? base + roleBonus : round1(base * roleMul) + roleBonus

    // ── Tog-synergi: spurteren forstærkes af leadout-mænd ──
    if (trainActive && r.role === 'sprinter') {
      synergy = round1(base * roleMul * (trainMul - 1))
      notes.push(`tog ×${trainMul.toFixed(1)}`)
    }

    let total = rolePoints + synergy

    // DNF-straf (joker undtaget) — som produktion: -50%, min -5
    if (r.dnf && r.role !== 'joker') {
      const would = rolePoints + synergy
      dnfPen = would > 0 ? -round1(would * 0.5) : -5
      dnfPen = Math.min(dnfPen, -5)
      total = round1(rolePoints + synergy + dnfPen)
    }

    return {
      ...r,
      bd: { base, roleMul: round1(roleMul), roleBonus, synergy, dnfPen, total: round1(total), notes },
    }
  })

  const total = round1(rows.reduce((s, r) => s + r.bd.total, 0))
  return { rows, total, trainActive, trainMul }
}
