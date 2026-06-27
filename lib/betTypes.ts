/**
 * Konsistente bet_type værdier på tværs af frontend, API og beregningslogik.
 * Brug disse værdier overalt — ikke strenge direkte.
 */
export const BET_TYPES = {
  MATCH_RESULT: 'match_result',
  GOALS_3PLUS: 'goals_3plus',
  CLEAN_SHEET: 'clean_sheet',
  WIN_MARGIN: 'win_margin',
  // Knockout-ekstra-bets — kun gyldige på is_knockout-kampe når brugerens
  // match_result = 'X' (uafgjort efter ordinær tid → forlænget/straffe).
  KO_ADVANCE: 'ko_advance', // prediction '1'/'2' — hvem går videre
  KO_METHOD: 'ko_method',   // prediction 'et'/'pen' — forlænget eller straffe
} as const

export type BetType = (typeof BET_TYPES)[keyof typeof BET_TYPES]

export const BET_TYPE_LABELS: Record<BetType, string> = {
  match_result: 'Kampresultat',
  goals_3plus: 'Scorer 3+ mål',
  clean_sheet: 'Clean sheet',
  win_margin: 'Vinder med 2+',
  ko_advance: 'Går videre',
  ko_method: 'Afgøres på',
}

export const PREDICTION_LABELS: Record<string, string> = {
  '1': 'Hjemmehold',
  'X': 'Uafgjort',
  '2': 'Udehold',
  // ko_method
  'et': 'Forlænget spilletid',
  'pen': 'Straffespark',
}

/** Bet-typer der kun gælder knockout-kampe (vises kun ved X-valg). */
export const KO_BET_TYPES: readonly string[] = [BET_TYPES.KO_ADVANCE, BET_TYPES.KO_METHOD]
