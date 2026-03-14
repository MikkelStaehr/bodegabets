/**
 * Mapping mellem prediction (1/X/2) og home_score/away_score i bets-tabellen.
 */

export type MatchResultPrediction = '1' | 'X' | '2'

export function predictionToScores(prediction: MatchResultPrediction): {
  home_score: number
  away_score: number
} {
  switch (prediction) {
    case '1':
      return { home_score: 1, away_score: 0 }
    case 'X':
      return { home_score: 0, away_score: 0 }
    case '2':
      return { home_score: 0, away_score: 1 }
    default:
      return { home_score: 0, away_score: 0 }
  }
}

export function scoresToPrediction(
  home_score: number,
  away_score: number
): MatchResultPrediction {
  if (home_score > away_score) return '1'
  if (away_score > home_score) return '2'
  return 'X'
}
