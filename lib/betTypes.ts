/**
 * Konsistente bet_type værdier på tværs af frontend, API og beregningslogik.
 * Brug disse værdier overalt — ikke strenge direkte.
 */
export const BET_TYPES = {
  MATCH_RESULT: 'match_result',
  BTTS: 'btts',
  OVER_UNDER: 'over_under',
  HALVLEG: 'halvleg',
  MALFORSKEL: 'malforskel',
} as const

export const BET_TYPES_LEGACY = {
  FIRST_SCORER: 'first_scorer',
  TOTAL_GOALS: 'total_goals',
  YELLOW_CARDS: 'yellow_cards',
  RED_CARDS: 'red_cards',
  HALFTIME: 'halftime', // Legacy — brug HALVLEG for nye
} as const

export type BetType =
  | (typeof BET_TYPES)[keyof typeof BET_TYPES]
  | (typeof BET_TYPES_LEGACY)[keyof typeof BET_TYPES_LEGACY]

// Labels til UI (bet_type → visningsnavn)
export const BET_TYPE_LABELS: Partial<Record<BetType, string>> = {
  match_result: 'Kampresultat',
  btts: 'Begge scorer',
  over_under: 'Over/under',
  halvleg: 'Halvleg',
  malforskel: 'Målforskel',
  first_scorer: 'Første målscorer',
  total_goals: 'Antal mål',
  yellow_cards: 'Gule kort',
  red_cards: 'Røde kort',
  halftime: 'Halvtidsresultat',
}

// Præcise prediction-værdier per bet_type (lagret i DB → visningslabel)
export const PREDICTION_LABELS: Record<string, string> = {
  // match_result
  '1': 'Hjemmehold sejr',
  X: 'Uafgjort',
  '2': 'Udehold sejr',
  // btts
  yes: 'Ja',
  no: 'Nej',
  // over_under
  over: 'Over 2.5',
  under: 'Under 2.5',
  // halvleg
  h1: '1. halvleg',
  h2: '2. halvleg',
  draw: 'Lige',
  // malforskel
  '2plus': '2+ mål',
  '1goal': '1 mål',
  udraw: 'Uafgjort',
}

// UI-label → lagret prediction-værdi (til submit)
export const UI_TO_STORED: Record<string, Record<string, string>> = {
  btts: { Ja: 'yes', Nej: 'no' },
  over_under: { Over: 'over', Under: 'under' },
  halvleg: { '1. HV': 'h1', '2. HV': 'h2', Lige: 'draw' },
  malforskel: { '2+': '2plus', '1 mål': '1goal', Uafgjort: 'udraw' },
}

// Lagret prediction → UI-label (til visning)
export const STORED_TO_UI: Record<string, Record<string, string>> = {
  btts: { yes: 'Ja', no: 'Nej' },
  over_under: { over: 'Over', under: 'Under' },
  halvleg: { h1: '1. HV', h2: '2. HV', draw: 'Lige' },
  malforskel: { '2plus': '2+', '1goal': '1 mål', udraw: 'Uafgjort' },
}
