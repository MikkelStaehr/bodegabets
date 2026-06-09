/**
 * Beregner rolle-værdi pr. etape-profil — én kilde til sandhed for UI'ets
 * "stage-strategi"-visning. Trækker fra de centrale konstanter i
 * cyclingScoringConstants.ts så reglerne ikke driver fra hinanden.
 */

export type StageStrength = 'high' | 'mid' | 'low'

export type RoleStageBonus = {
  /** Profil-multiplikator hvis rollen har en (Grimpeur/Sprinter). 1 ellers. */
  multiplier: number
  /** Kort label til pill ved siden af rolle-label, fx "×1.8 BJERG". Tomt = vis intet. */
  pillLabel: string
  /** En-linjes beskrivelse til briefing-cardet, fx "KOM-jagt + topplaceringer". */
  cardLine: string
  /** Sortering i briefing-card: high først, low sidst. */
  strength: StageStrength
}

/** Læselig label til etape-profilen. */
export function profileLabel(profile: string | null | undefined): string {
  switch (profile) {
    case 'mountain': return 'bjerg'
    case 'hilly': return 'bakke'
    case 'flat': return 'flad'
    case 'mixed': return 'blandet'
    case 'cobbled': return 'brosten'
    case 'ttt': return 'holdtempo'
    default: return ''
  }
}

/**
 * Returnerer hvordan en rolle står på en given etape-profil. base-rolle
 * forventes (uden _0/_1 suffix). Profil null behandles som "ukendt" og giver
 * neutralt udfald.
 */
export function getRoleStageBonus(role: string, profile: string | null): RoleStageBonus {
  const pName = profileLabel(profile)
  const pUp = pName.toUpperCase()

  // TTT (hold-tempo): HELT flad holdscore. Basispoint = holdets placering, ens
  // for alle ryttere på holdet — ingen kategori, ingen rolle, ingen GC. Kun
  // trøje-point lægges oveni. Alle roller har derfor samme udfald.
  if (profile === 'ttt') {
    return { multiplier: 1.0, pillLabel: '', cardLine: 'Holdets placering — ens for alle på holdet (+ evt. trøje)', strength: 'mid' }
  }

  switch (role) {
    case 'grimpeur': {
      if (profile === 'mountain') return { multiplier: 1.8, pillLabel: `×1.8 ${pUp}`, cardLine: 'Bjerg-bonus + breakaway-jagt', strength: 'high' }
      if (profile === 'hilly' || profile === 'cobbled') return { multiplier: 1.2, pillLabel: `×1.2 ${pUp}`, cardLine: 'Let bakke-bonus, KOM-mulighed', strength: 'mid' }
      return { multiplier: 1.0, pillLabel: '', cardLine: 'Ingen profil-bonus i dag', strength: 'low' }
    }
    case 'sprinter': {
      if (profile === 'flat' || profile === 'mixed') return { multiplier: 1.8, pillLabel: `×1.8 ${pUp}`, cardLine: 'Massespurt forventet', strength: 'high' }
      if (profile === 'hilly' || profile === 'cobbled') return { multiplier: 1.2, pillLabel: `×1.2 ${pUp}`, cardLine: 'Hård spurt — reduceret bonus', strength: 'mid' }
      return { multiplier: 1.0, pillLabel: '', cardLine: 'Næppe relevant på denne profil', strength: 'low' }
    }
    case 'lieutenant': {
      // Profil-uafhængig: ×1.8 hvis top-10, ×2.8 hvis Leader DNF
      return { multiplier: 1.8, pillLabel: 'TOP-10 ×1.8', cardLine: 'Backup hvis Leader fejler (×2.8)', strength: 'mid' }
    }
    case 'leader': {
      // Leader scorer altid baseret på placering × kategori; ingen profil-bonus,
      // men er hjørnesten på alle etaper.
      return { multiplier: 1.0, pillLabel: '', cardLine: 'Placering × kategori (uafhængig af profil)', strength: 'mid' }
    }
    case 'domestique': {
      return { multiplier: 1.0, pillLabel: '', cardLine: '+8 hvis top-40 OG Leader top-10', strength: 'mid' }
    }
    case 'equipier': {
      // Equipier får leadout-bonus hvis flat/hilly/cobbled (gennem sprinter)
      const isSprintProfile = profile === 'flat' || profile === 'mixed' || profile === 'hilly' || profile === 'cobbled'
      return {
        multiplier: 1.0,
        pillLabel: '',
        cardLine: isSprintProfile ? 'Leadout-bonus til Sprinter (+20% / leadout)' : '+7 holdbonus hvis vinderhold',
        strength: isSprintProfile ? 'mid' : 'low',
      }
    }
    case 'joker': {
      return { multiplier: 1.0, pillLabel: '', cardLine: '+7 holdbonus + score som normal rolle', strength: 'mid' }
    }
    default:
      return { multiplier: 1.0, pillLabel: '', cardLine: '', strength: 'low' }
  }
}

/**
 * Samlet briefing til en stage: roller sorteret efter strength (high først),
 * dedupet til base-roller (kun én "Équipier"-linje selv om der er 3 slots).
 */
export function getStageBriefing(roleKeys: string[], profile: string | null) {
  const seen = new Set<string>()
  const order = { high: 0, mid: 1, low: 2 } as const
  type Entry = { role: string; label: string; bonus: RoleStageBonus }
  const entries: Entry[] = []
  for (const key of roleKeys) {
    const base = key.startsWith('equipier_') ? 'equipier' : key
    if (seen.has(base)) continue
    seen.add(base)
    const bonus = getRoleStageBonus(base, profile)
    if (!bonus.cardLine) continue
    entries.push({ role: base, label: ROLE_DISPLAY_NAME[base] ?? base, bonus })
  }
  entries.sort((a, b) => order[a.bonus.strength] - order[b.bonus.strength])
  return entries
}

const ROLE_DISPLAY_NAME: Record<string, string> = {
  leader: 'Leader',
  lieutenant: 'Lieutenant',
  grimpeur: 'Grimpeur',
  sprinter: 'Sprinter',
  domestique: 'Domestique',
  equipier: 'Équipier',
  joker: 'Joker',
}
