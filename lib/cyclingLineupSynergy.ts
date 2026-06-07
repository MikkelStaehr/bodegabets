/**
 * Analyserer et lineup for SYNERGI mellem valgte ryttere.
 *
 * Forskellig fra StageStrategyCard som viser hvilke roller er stærke i dag.
 * Her vurderer vi om dit faktiske valg arbejder sammen: er Sprinter'ens
 * equipiers fra samme hold (= leadout-tog), har du flere ryttere fra
 * Leader's hold (= flere chancer for hold-bonus), er bænk-roller udnyttet.
 *
 * Holdes adskilt fra calculateCyclingPoints.ts så scoring-logikken forbliver
 * den autoritative kilde — vi kalder ikke beregneren her, vi peger blot på
 * de samme mekanismer.
 */

export type SynergyStatus = 'good' | 'warn' | 'info'

export type SynergyCheck = {
  id: string
  status: SynergyStatus
  title: string
  detail: string
}

type LineupRider = {
  id: string
  last_name: string
  team_name: string
  category: number
}

type SlotMap = Partial<Record<string, string | null>>

function getRider(slots: SlotMap, role: string, riders: Map<string, LineupRider>): LineupRider | null {
  const id = slots[role]
  if (!id) return null
  return riders.get(id) ?? null
}

function getEquipiers(slots: SlotMap, riders: Map<string, LineupRider>): LineupRider[] {
  const out: LineupRider[] = []
  for (const key of ['equipier_0', 'equipier_1', 'equipier_2']) {
    const id = slots[key]
    if (!id) continue
    const r = riders.get(id)
    if (r) out.push(r)
  }
  return out
}

export function analyzeLineupSynergy(
  slots: SlotMap,
  ridersList: LineupRider[],
  profile: string | null,
): SynergyCheck[] {
  const riders = new Map<string, LineupRider>()
  for (const r of ridersList) riders.set(r.id, r)

  const checks: SynergyCheck[] = []
  const leader = getRider(slots, 'leader', riders)
  const lieutenant = getRider(slots, 'lieutenant', riders)
  const grimpeur = getRider(slots, 'grimpeur', riders)
  const sprinter = getRider(slots, 'sprinter', riders)
  const domestique = getRider(slots, 'domestique', riders)
  const joker = getRider(slots, 'joker', riders)
  const equipiers = getEquipiers(slots, riders)

  // ── R1: Sprinter + leadout-tog ────────────────────────────────
  // Equipiers fra Sprinter's hold giver +20% pr. stk., cap 2 (= ×1.4).
  // Kun aktivt på sprint-profil (flat/mixed/hilly/cobbled).
  const isSprintProfile = profile === 'flat' || profile === 'mixed' || profile === 'hilly' || profile === 'cobbled'
  if (sprinter) {
    const leadouts = equipiers.filter((e) => e.team_name === sprinter.team_name)
    if (!isSprintProfile) {
      checks.push({
        id: 'sprinter-no-profile',
        status: 'info',
        title: `Sprinter passer ikke til profilen`,
        detail: `${sprinter.last_name} får ingen sprint-profil-multiplikator i dag. Tog-bonus er irrelevant.`,
      })
    } else if (leadouts.length >= 2) {
      checks.push({
        id: 'sprinter-train-full',
        status: 'good',
        title: `Fuldt leadout-tog (+40%)`,
        detail: `${sprinter.last_name} har 2 équipier(e) fra ${sprinter.team_name}. ×1.4 hvis Sprinter top-3.`,
      })
    } else if (leadouts.length === 1) {
      checks.push({
        id: 'sprinter-train-partial',
        status: 'good',
        title: `Leadout-tog (+20%)`,
        detail: `${leadouts[0].last_name} kører for ${sprinter.last_name}. ×1.2 hvis Sprinter top-3. Tilføj én équipier mere fra ${sprinter.team_name} for fuld bonus.`,
      })
    } else {
      checks.push({
        id: 'sprinter-no-train',
        status: 'warn',
        title: `Sprinter uden leadout-tog`,
        detail: `Ingen équipiers fra ${sprinter.team_name}. ${sprinter.last_name} kører solo — tog-bonus ikke aktiv.`,
      })
    }
  }

  // ── R2: Hold-koncentration omkring Leader ─────────────────────
  // Flere ryttere fra Leader's hold = flere chancer for hold-bonus
  // hvis Leader's hold vinder etapen.
  if (leader) {
    const sameTeam = [lieutenant, grimpeur, sprinter, domestique, ...equipiers, joker]
      .filter((r): r is LineupRider => r !== null && r.team_name === leader.team_name)
    if (sameTeam.length >= 3) {
      checks.push({
        id: 'leader-team-stack',
        status: 'good',
        title: `${sameTeam.length + 1} ryttere fra ${leader.team_name}`,
        detail: `Stor satsning. Vinder ${leader.team_name} etapen, får alle hold-bonus (+5 / +7 pr. rytter).`,
      })
    } else if (sameTeam.length === 0) {
      checks.push({
        id: 'leader-team-solo',
        status: 'info',
        title: `Leader er ene fra ${leader.team_name}`,
        detail: `Ingen øvrige fra hendes hold. Hold-bonus aktiveres kun for ${leader.last_name} hvis hendes hold vinder.`,
      })
    }
  }

  // ── R3: Lieutenant backup-mekanisme ────────────────────────────
  if (leader && lieutenant) {
    checks.push({
      id: 'lieutenant-backup',
      status: 'good',
      title: `Backup klar — Lieutenant`,
      detail: `${lieutenant.last_name} giver ×1.8 hvis top-10 (×2.8 hvis ${leader.last_name} udgår).`,
    })
  } else if (leader && !lieutenant) {
    checks.push({
      id: 'lieutenant-missing',
      status: 'warn',
      title: `Ingen Lieutenant`,
      detail: `Du har ingen backup hvis Leader udgår. Lieutenant ×1.8/×2.8 forspild.`,
    })
  }

  // ── R4: Domestique tilstedeværelse ─────────────────────────────
  if (domestique && leader) {
    checks.push({
      id: 'domestique-armed',
      status: 'good',
      title: `Domestique-bonus klar`,
      detail: `${domestique.last_name} +8 hvis top-40 OG ${leader.last_name} top-10.`,
    })
  } else if (!domestique) {
    checks.push({
      id: 'domestique-missing',
      status: 'info',
      title: `Ingen Domestique`,
      detail: `Du springer +8 bonus over hvis Leader top-10. Kun Kat-4 ryttere kvalificerer.`,
    })
  }

  // ── R5: Grimpeur match med bjerg-profil ────────────────────────
  if (grimpeur) {
    if (profile === 'mountain') {
      checks.push({
        id: 'grimpeur-mountain',
        status: 'good',
        title: `Grimpeur i bjerget`,
        detail: `${grimpeur.last_name} kører med ×1.8 profil-bonus + chance for KOM/breakaway-point.`,
      })
    } else if (profile === 'flat') {
      checks.push({
        id: 'grimpeur-flat',
        status: 'warn',
        title: `Grimpeur på flad etape`,
        detail: `${grimpeur.last_name} har ingen profil-bonus i dag — overvej Sprinter i stedet næste gang.`,
      })
    }
  }

  // ── R6: Joker tilstedeværelse ──────────────────────────────────
  if (joker) {
    checks.push({
      id: 'joker-armed',
      status: 'info',
      title: `Joker valgt`,
      detail: `${joker.last_name} scorer som normal rolle + 7 hvis hendes hold vinder. Immun mod DNF-straf.`,
    })
  }

  // ── R7: Tomme slots ────────────────────────────────────────────
  const slotKeys = ['leader', 'lieutenant', 'grimpeur', 'sprinter', 'domestique', 'equipier_0', 'equipier_1', 'equipier_2', 'joker']
  const empties = slotKeys.filter((k) => !slots[k])
  if (empties.length > 0) {
    checks.push({
      id: 'empty-slots',
      status: 'warn',
      title: `${empties.length} tomme slots`,
      detail: `Hvert tomt slot er 0 point. Udfyld alle slots for fuldt potentiale.`,
    })
  }

  return checks
}
