/**
 * matchBoldIds.ts
 * Previously matched matches with Bold.dk IDs via the matches.bold_match_id column.
 * That column has been dropped — bold_match_id now lives on league_matches.
 * These functions are kept as no-ops for backwards compatibility with scripts/API routes.
 */

export type MatchBoldResult = {
  matched: number
  details: Array<{
    home_team: string
    away_team: string
    bold_id: number
    match_ids: number[]
  }>
  errors: string[]
}

export async function runMatchBoldIds(): Promise<MatchBoldResult> {
  // No-op: bold_match_id column no longer exists on matches table
  return { matched: 0, details: [], errors: [] }
}

export async function logMatchBoldRun(
  _result: MatchBoldResult,
  _status: 'ok' | 'error',
  _errorMessage?: string
) {
  // No-op
}
