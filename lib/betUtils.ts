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
  const total = homeScore + awayScore
  const diff = Math.abs(homeScore - awayScore)

  switch (betType) {
    case BET_TYPES.MATCH_RESULT:
      if (prediction === '1') return homeScore > awayScore
      if (prediction === 'X') return homeScore === awayScore
      if (prediction === '2') return awayScore > homeScore
      return false

    case BET_TYPES.BTTS:
      if (prediction === 'yes' || prediction === 'ja') return homeScore > 0 && awayScore > 0
      if (prediction === 'no' || prediction === 'nej') return !(homeScore > 0 && awayScore > 0)
      return false

    case BET_TYPES.OVER_UNDER:
      if (prediction === 'over') return total > 2.5
      if (prediction === 'under') return total <= 2.5
      return false

    case BET_TYPES.HALVLEG:
    case 'halftime':
      if (homeHtScore == null || awayHtScore == null) return false
      if (prediction === 'h1') return homeHtScore > awayHtScore
      if (prediction === 'h2') return homeHtScore < awayHtScore
      if (prediction === 'draw') return homeHtScore === awayHtScore
      return false

    case BET_TYPES.MALFORSKEL:
      if (prediction === '2plus' || prediction === '2+') return diff >= 2
      if (prediction === '1goal' || prediction === '1') return diff === 1
      if (prediction === 'udraw' || prediction === 'draw') return diff === 0
      return false

    default:
      return false
  }
}
