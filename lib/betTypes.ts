/**
 * Konsistente bet_type værdier på tværs af frontend, API og beregningslogik.
 * Brug disse værdier overalt — ikke strenge direkte.
 */
export const BET_TYPES = {
  MATCH_RESULT: 'match_result',
  GOALS_3PLUS: 'goals_3plus',
  CLEAN_SHEET: 'clean_sheet',
  WIN_MARGIN: 'win_margin',
} as const

export type BetType = (typeof BET_TYPES)[keyof typeof BET_TYPES]

export const BET_TYPE_LABELS: Record<BetType, string> = {
  match_result: 'Kampresultat',
  goals_3plus: 'Scorer 3+ mål',
  clean_sheet: 'Clean sheet',
  win_margin: 'Vinder med 2+',
}

export const PREDICTION_LABELS: Record<string, string> = {
  '1': 'Hjemmehold',
  'X': 'Uafgjort',
  '2': 'Udehold',
}
