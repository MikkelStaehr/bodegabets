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

export function slotsForProfile(profile: string | null | undefined): CyclingRoleKey[] {
  switch (profile) {
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
