import type { CyclingRoleKey } from '@/types/cycling'

/**
 * Dynamiske roller: stage-profilen bestemmer hvilke 8 rolle-slots der vises.
 * Den terræn-irrelevante forstærker droppes, og den frigjorte plads bliver en
 * ekstra equipier (på flad = ekstra leadout til spurt-toget; på bjerg = ekstra
 * holdstøtte). Slot-sættet matcher scoring-multiplierne:
 *   - flad/mixed  → spurter favoriseres, ingen klatrer
 *   - bjerg       → klatrer favoriseres, ingen spurter
 *   - bakket/cobbled/ukendt → begge motorer i spil
 */
const BOTH: CyclingRoleKey[] = ['leader', 'lieutenant', 'grimpeur', 'sprinter', 'domestique', 'equipier_0', 'equipier_1', 'joker']
const SPRINT: CyclingRoleKey[] = ['leader', 'lieutenant', 'sprinter', 'domestique', 'equipier_0', 'equipier_1', 'equipier_2', 'joker']
const CLIMB: CyclingRoleKey[] = ['leader', 'lieutenant', 'grimpeur', 'domestique', 'equipier_0', 'equipier_1', 'equipier_2', 'joker']
// TTT: rolle-løs holdetape. 6 generiske "Rytter"-slots (vist neutralt), max 2
// pr. hold (valideres i lineup-API'et). Genbruger equipier-keys fordi de har
// ingen kategori-regel og lagres som base-rolle 'equipier' + slot_index.
const TTT: CyclingRoleKey[] = ['equipier_0', 'equipier_1', 'equipier_2', 'equipier_3', 'equipier_4', 'equipier_5']

export function slotsForProfile(profile: string | null | undefined): CyclingRoleKey[] {
  switch (profile) {
    case 'ttt':
      return TTT
    case 'flat':
    case 'mixed':
      return SPRINT
    case 'mountain':
      return CLIMB
    case 'hilly':
    case 'cobbled':
    default:
      return BOTH
  }
}

/**
 * Remap et sæt slots (typisk fra et preset gemt for én profil) til den
 * aktive etapes profil. Ryttere i preset-roller der ikke findes på den
 * aktive profil (fx `equipier_2` fra et bjerg-preset anvendt på en kuperet
 * etape) flyttes til tomme equipier-slots, eller ellers et tomt slot.
 *
 * Garanterer at INGEN ryttere mistes, så længe der er ledige slots — hvis
 * preset har flere ryttere end den aktive profil kan rumme, dropper vi
 * overskuddet (kan ikke ske i praksis: begge sæt har 8 slots).
 */
export function remapSlotsToProfile(
  presetSlots: Partial<Record<CyclingRoleKey, string | null>>,
  activeProfile: string | null | undefined,
): Record<CyclingRoleKey, string | null> {
  const ALL_KEYS: CyclingRoleKey[] = [
    'leader', 'lieutenant', 'grimpeur', 'sprinter',
    'domestique', 'equipier_0', 'equipier_1', 'equipier_2', 'joker',
  ]
  const result: Record<CyclingRoleKey, string | null> = Object.fromEntries(
    ALL_KEYS.map((k) => [k, null]),
  ) as Record<CyclingRoleKey, string | null>

  const activeSlots = slotsForProfile(activeProfile)
  const activeSet = new Set(activeSlots)

  // 1. Kopier roller der eksisterer på den aktive profil 1:1
  const orphanRiders: string[] = []
  for (const role of ALL_KEYS) {
    const rider = presetSlots[role]
    if (!rider) continue
    if (activeSet.has(role)) {
      result[role] = rider
    } else {
      orphanRiders.push(rider)
    }
  }

  // 2. Placér orphans i tomme equipier-slots på aktiv profil (samme rolle-type)
  const emptyEquipierSlots = activeSlots.filter(
    (r) => r.startsWith('equipier_') && result[r] === null,
  )
  let oi = 0
  for (const slot of emptyEquipierSlots) {
    if (oi >= orphanRiders.length) break
    result[slot] = orphanRiders[oi++]
  }

  // 3. Hvis stadig orphans tilbage, fyld øvrige tomme slots i aktiv profil
  if (oi < orphanRiders.length) {
    const otherEmpty = activeSlots.filter(
      (r) => !r.startsWith('equipier_') && result[r] === null,
    )
    for (const slot of otherEmpty) {
      if (oi >= orphanRiders.length) break
      result[slot] = orphanRiders[oi++]
    }
  }

  return result
}
