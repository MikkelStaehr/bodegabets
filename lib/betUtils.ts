import { BET_TYPES } from './betTypes'

// Tjek om prediction er korrekt
export function isBetCorrect(
  betType: string,
  prediction: string,
  homeScore: number,
  awayScore: number,
  homeHtScore?: number | null,
  awayHtScore?: number | null
): boolean {
  switch (betType) {
    case BET_TYPES.MATCH_RESULT:
      if (prediction === '1') return homeScore > awayScore
      if (prediction === 'X') return homeScore === awayScore
      if (prediction === '2') return awayScore > homeScore
      return false

    case BET_TYPES.GOALS_3PLUS:
      if (prediction === '1') return homeScore >= 3
      if (prediction === '2') return awayScore >= 3
      return false

    case BET_TYPES.CLEAN_SHEET:
      if (prediction === '1') return awayScore === 0 && homeScore > 0
      if (prediction === '2') return homeScore === 0 && awayScore > 0
      return false

    case BET_TYPES.WIN_MARGIN:
      if (prediction === '1') return homeScore - awayScore >= 2
      if (prediction === '2') return awayScore - homeScore >= 2
      return false

    default:
      return false
  }
}
