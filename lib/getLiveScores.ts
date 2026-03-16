/**
 * getLiveScores.ts
 * Henter live scores fra Bold API for alle kampe i en runde.
 *
 * Bruger league_matches.bold_match_id direkte til at hente scores fra Bold API.
 */

import { supabaseAdmin } from '@/lib/supabase'

const BOLD_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

export type LiveScoreResult = {
  league_match_id: number
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'finished'
  minute: number | null
}

function mapStatus(statusType: string): LiveScoreResult['status'] {
  if (statusType === 'live' || statusType === 'inprogress') return 'live'
  if (statusType === 'finished') return 'finished'
  return 'scheduled'
}

export async function getLiveScores(roundId: number): Promise<LiveScoreResult[]> {
  // 1. Hent matches for round_id (med league_match_id)
  const { data: matchRows } = await supabaseAdmin
    .from('matches')
    .select('id, league_match_id')
    .eq('round_id', roundId)
    .not('league_match_id', 'is', null)

  if (!matchRows?.length) return []

  const leagueMatchIds = (matchRows as { league_match_id: number }[])
    .map((r) => r.league_match_id)
    .filter((id): id is number => id != null)

  // 2. Hent league_matches med bold_match_id
  const { data: leagueMatches } = await supabaseAdmin
    .from('league_matches')
    .select('id, bold_match_id')
    .in('id', leagueMatchIds)
    .not('bold_match_id', 'is', null)

  if (!leagueMatches?.length) return []

  const boldMatchIds = leagueMatches
    .map((lm) => (lm as { bold_match_id: number }).bold_match_id)
    .filter((id): id is number => id != null)

  if (!boldMatchIds.length) return []

  const lmByBoldId = new Map<number, number>()
  for (const lm of leagueMatches) {
    const boldId = (lm as { bold_match_id: number }).bold_match_id
    if (boldId != null) lmByBoldId.set(boldId, lm.id)
  }

  // 3. Hent scores fra Bold API via match_ids
  try {
    const url = `${BOLD_API}?match_ids=${boldMatchIds.join(',')}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BodegaBets/1.0', Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) return []

    const data = (await res.json()) as { matches?: Array<{ match: { id: number; status_type: string; time: number | null; home_team: { score: number }; away_team: { score: number } } }> }

    const results: LiveScoreResult[] = []
    for (const m of data.matches ?? []) {
      const match = m.match
      if (!match) continue

      const leagueMatchId = lmByBoldId.get(match.id)
      if (!leagueMatchId) continue

      const status = mapStatus(match.status_type)
      if (status === 'scheduled') continue

      results.push({
        league_match_id: leagueMatchId,
        home_score: match.home_team?.score ?? null,
        away_score: match.away_team?.score ?? null,
        status,
        minute: match.time ?? null,
      })
    }

    return results
  } catch (err) {
    console.error('[getLiveScores] Bold API fejl:', err)
    return []
  }
}
