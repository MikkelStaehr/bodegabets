/**
 * Analyserer et lineup for SYNERGI — per rytter, ikke som globalt overblik.
 *
 * Hver rytter får 0-N checks der beskriver hvordan netop hans rolle og
 * placering i lineup'en aktiverer (eller spilder) scoring-mekanismer.
 * UI'et renderer worst-case ikon ud for rytter-rækken og viser detaljer
 * på hover/tap.
 *
 * Holdes adskilt fra calculateCyclingPoints.ts så scoring-logikken forbliver
 * autoritativ kilde — vi peger blot på de samme mekanismer.
 */

export type SynergyStatus = 'good' | 'warn' | 'bad' | 'info'

/** Sort-rank — værst tilstand bestemmer rytterens samlede ikon. */
const STATUS_RANK: Record<SynergyStatus, number> = { bad: 0, warn: 1, good: 2, info: 3 }

export type RiderSynergyCheck = {
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

function getEquipiers(slots: SlotMap, riders: Map<string, LineupRider>): { key: string; rider: LineupRider }[] {
  const out: { key: string; rider: LineupRider }[] = []
  for (const key of ['equipier_0', 'equipier_1', 'equipier_2']) {
    const id = slots[key]
    if (!id) continue
    const r = riders.get(id)
    if (r) out.push({ key, rider: r })
  }
  return out
}

export function analyzeLineupSynergy(
  slots: SlotMap,
  ridersList: LineupRider[],
  profile: string | null,
): Map<string, RiderSynergyCheck[]> {
  const riders = new Map<string, LineupRider>()
  for (const r of ridersList) riders.set(r.id, r)

  const byRider = new Map<string, RiderSynergyCheck[]>()
  const push = (riderId: string, check: RiderSynergyCheck) => {
    if (!byRider.has(riderId)) byRider.set(riderId, [])
    byRider.get(riderId)!.push(check)
  }

  const leader = getRider(slots, 'leader', riders)
  const lieutenant = getRider(slots, 'lieutenant', riders)
  const grimpeur = getRider(slots, 'grimpeur', riders)
  const sprinter = getRider(slots, 'sprinter', riders)
  const domestique = getRider(slots, 'domestique', riders)
  const joker = getRider(slots, 'joker', riders)
  const equipiers = getEquipiers(slots, riders)

  const isSprintProfile = profile === 'flat' || profile === 'mixed' || profile === 'hilly' || profile === 'cobbled'

  // ── LEADER ────────────────────────────────────────────────────
  if (leader) {
    const teammates = [lieutenant, grimpeur, sprinter, domestique, ...equipiers.map((e) => e.rider), joker]
      .filter((r): r is LineupRider => r !== null && r.team_name === leader.team_name)
    if (teammates.length >= 3) {
      push(leader.id, {
        status: 'good',
        title: `Stærk hold-stack (${teammates.length + 1} fra ${leader.team_name})`,
        detail: `Vinder ${leader.team_name} etapen, får alle hold-bonus (+5/+7 pr. rytter).`,
      })
    } else {
      push(leader.id, {
        status: 'info',
        title: `Scorer placering × kategori × GC`,
        detail: `Leader får ingen profil-multiplikator — han henter point på selve placeringen og evt. trøjer.`,
      })
    }
  }

  // ── LIEUTENANT ────────────────────────────────────────────────
  if (lieutenant) {
    if (leader) {
      push(lieutenant.id, {
        status: 'good',
        title: `Backup ×1.8`,
        detail: `Hvis ${lieutenant.last_name} er top-10 får han ×1.8 (×2.8 hvis ${leader.last_name} udgår).`,
      })
      // Klassisk er Lieutenant fra Leader's hold — andre hold scorer
      // stadig ×1.8, men det er taktisk svagere.
      if (lieutenant.team_name === leader.team_name) {
        push(lieutenant.id, {
          status: 'good',
          title: `Holdkammerat med Leader`,
          detail: `${lieutenant.last_name} og ${leader.last_name} er på samme hold — klassisk backup-rolle.`,
        })
      } else {
        push(lieutenant.id, {
          status: 'warn',
          title: `Lieutenant fra andet hold`,
          detail: `${lieutenant.last_name} (${lieutenant.team_name}) er ikke holdkammerat med ${leader.last_name} (${leader.team_name}). Scoring kræver ikke match, men en Lieutenant fra Leader's hold er taktisk stærkere.`,
        })
      }
    } else {
      push(lieutenant.id, {
        status: 'warn',
        title: `Lieutenant uden Leader`,
        detail: `Backup-mekanismen kræver en Leader at "backe up" — vælg en Leader for at aktivere ×2.8 ved DNF.`,
      })
    }
    if (lieutenant.category > 3) {
      push(lieutenant.id, {
        status: 'bad',
        title: `Kategori-konflikt`,
        detail: `Lieutenant kræver Kat 2-3, men ${lieutenant.last_name} er Kat ${lieutenant.category}. Scorer ikke ×1.8.`,
      })
    }
  }

  // ── GRIMPEUR ──────────────────────────────────────────────────
  if (grimpeur) {
    if (profile === 'mountain') {
      push(grimpeur.id, {
        status: 'good',
        title: `Bjerg-profil aktiveret ×1.8`,
        detail: `${grimpeur.last_name} får ×1.8 profil-bonus + chance for KOM/breakaway-bonus.`,
      })
    } else if (profile === 'hilly' || profile === 'cobbled') {
      push(grimpeur.id, {
        status: 'good',
        title: `Bakke-profil ×1.2`,
        detail: `${grimpeur.last_name} får ×1.2 profil-bonus i dag.`,
      })
    } else {
      push(grimpeur.id, {
        status: 'warn',
        title: `Ingen profil-bonus i dag`,
        detail: `Grimpeur på flad/blandet etape får ingen profil-multiplikator. Overvej Sprinter i stedet.`,
      })
    }
    // Team-relation til Leader. Grimpeur har sin egen profil-bonus, så
    // mismatch er ikke kritisk — men hold-stack giver dobbelt team-bonus.
    if (leader) {
      if (grimpeur.team_name === leader.team_name) {
        push(grimpeur.id, {
          status: 'good',
          title: `Holdkammerat med Leader`,
          detail: `${grimpeur.last_name} på samme hold som ${leader.last_name} — dobbelt hold-bonus hvis ${leader.team_name} vinder.`,
        })
      }
    }
  }

  // ── SPRINTER ──────────────────────────────────────────────────
  if (sprinter) {
    if (profile === 'flat' || profile === 'mixed') {
      push(sprinter.id, {
        status: 'good',
        title: `Flad-profil ×1.8`,
        detail: `${sprinter.last_name} får ×1.8 profil-bonus — massespurt forventes.`,
      })
    } else if (profile === 'hilly' || profile === 'cobbled') {
      push(sprinter.id, {
        status: 'good',
        title: `Hård spurt ×1.2`,
        detail: `${sprinter.last_name} får ×1.2 profil-bonus i dag.`,
      })
    } else {
      push(sprinter.id, {
        status: 'warn',
        title: `Ingen profil-bonus i dag`,
        detail: `Sprinter på bjerg-etape får ingen profil-multiplikator.`,
      })
    }
    // Leadout-tog: équipiers fra Sprinter's hold
    const leadouts = equipiers.filter((e) => e.rider.team_name === sprinter.team_name)
    if (isSprintProfile) {
      if (leadouts.length >= 2) {
        push(sprinter.id, {
          status: 'good',
          title: `Fuldt leadout-tog ×1.4`,
          detail: `2 équipiers fra ${sprinter.team_name} kører for ${sprinter.last_name}. Tog-bonus aktiveres hvis top-3.`,
        })
      } else if (leadouts.length === 1) {
        push(sprinter.id, {
          status: 'good',
          title: `1 leadout ×1.2`,
          detail: `${leadouts[0].rider.last_name} kører for ${sprinter.last_name}. Tilføj én équipier mere fra ${sprinter.team_name} for fuld bonus.`,
        })
      } else {
        push(sprinter.id, {
          status: 'warn',
          title: `Ingen leadout-tog`,
          detail: `Ingen équipiers fra ${sprinter.team_name}. ${sprinter.last_name} kører solo i spurten.`,
        })
      }
    }
    // Team-relation til Leader. Sprinter har sin egen leadout-mekanisme,
    // så mismatch er typisk forventet (sprintere er ofte fra spritere-
    // specialiserede hold). Match er en bonus-koincidens.
    if (leader && sprinter.team_name === leader.team_name) {
      push(sprinter.id, {
        status: 'good',
        title: `Holdkammerat med Leader`,
        detail: `${sprinter.last_name} på samme hold som ${leader.last_name} — alle équipiers fra holdet bidrager til både leadout og team-bonus.`,
      })
    }
  }

  // ── DOMESTIQUE ────────────────────────────────────────────────
  if (domestique) {
    if (leader) {
      // Scoring kræver ikke team-match for +8, men i praksis er det sværere
      // for en Domestique fra et andet hold at sikre top-40 koordineret med
      // Leader top-10. Hvis Domestique er fra Leader's hold er det taktisk
      // den klassiske rolle (hjælper sin kaptajn frem).
      if (domestique.team_name === leader.team_name) {
        push(domestique.id, {
          status: 'good',
          title: `Domestique fra Leader's hold`,
          detail: `${domestique.last_name} kører for ${leader.last_name}. +8 hvis han er top-40 OG ${leader.last_name} er top-10.`,
        })
      } else {
        push(domestique.id, {
          status: 'warn',
          title: `Domestique fra andet hold`,
          detail: `${domestique.last_name} (${domestique.team_name}) er ikke holdkammerat med ${leader.last_name} (${leader.team_name}). Scoring kræver ikke team-match, men en Domestique fra Leader's hold er taktisk stærkere.`,
        })
      }
    } else {
      push(domestique.id, {
        status: 'warn',
        title: `Domestique uden Leader`,
        detail: `+8-bonus kræver Leader top-10 — uden Leader kan bonusen ikke aktiveres.`,
      })
    }
    if (domestique.category !== 4) {
      push(domestique.id, {
        status: 'bad',
        title: `Kategori-konflikt`,
        detail: `Domestique kræver Kat 4, men ${domestique.last_name} er Kat ${domestique.category}.`,
      })
    }
  }

  // ── EQUIPIERS ─────────────────────────────────────────────────
  for (const { rider } of equipiers) {
    let hasGoodSynergy = false
    // Leadout for Sprinter?
    if (sprinter && rider.team_name === sprinter.team_name && isSprintProfile) {
      push(rider.id, {
        status: 'good',
        title: `Leadout for ${sprinter.last_name}`,
        detail: `Samme hold som Sprinter — bidrager til ×1.2/×1.4 tog-bonus hvis Sprinter top-3.`,
      })
      hasGoodSynergy = true
    }
    // Holdkammerat med Leader?
    if (leader && rider.team_name === leader.team_name) {
      push(rider.id, {
        status: 'good',
        title: `Holdkammerat med Leader`,
        detail: `Samme hold som ${leader.last_name} — får hold-bonus (+7) hvis ${leader.team_name} vinder etapen.`,
      })
      hasGoodSynergy = true
    }
    if (!hasGoodSynergy) {
      push(rider.id, {
        status: 'info',
        title: `+7 hvis hans hold vinder`,
        detail: `${rider.last_name} har ingen tog- eller hold-synergi med dine andre roller. Han scorer kun via hold-bonus eller egen placering.`,
      })
    }
  }

  // ── JOKER ─────────────────────────────────────────────────────
  if (joker) {
    if (leader && joker.team_name === leader.team_name) {
      push(joker.id, {
        status: 'good',
        title: `Joker fra Leader's hold`,
        detail: `${joker.last_name} på samme hold som ${leader.last_name}. Hvis ${leader.team_name} vinder, dobbelt team-bonus + Joker er immun mod DNF.`,
      })
    } else {
      push(joker.id, {
        status: 'info',
        title: `+7 hvis hans hold vinder`,
        detail: `${joker.last_name} scorer som almindelig rolle og er immun mod DNF-tab.`,
      })
    }
  }

  return byRider
}

/** Den vigtigste status for en rytter — bestemmer hvilket ikon der vises. */
export function worstStatus(checks: RiderSynergyCheck[]): SynergyStatus | null {
  if (checks.length === 0) return null
  return checks.reduce<SynergyStatus>((worst, c) =>
    STATUS_RANK[c.status] < STATUS_RANK[worst] ? c.status : worst, 'info')
}
