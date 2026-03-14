/**
 * getLiveScores.ts
 * Henter live scores fra Bold API for alle kampe i en runde.
 * Nyt skema: matches har bold_match_id direkte.
 */

import { supabaseAdmin } from '@/lib/supabase'

const BOLD_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

export type LiveScoreResult = {
  match_id: number
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
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('season_id, name')
    .eq('id', roundId)
    .single()
  if (!round?.season_id || !round?.name) return []

  const { data: matchRows } = await supabaseAdmin
    .from('matches')
    .select('id, bold_match_id')
    .eq('season_id', round.season_id)
    .eq('round_name', round.name)
    .not('bold_match_id', 'is', null)

  if (!matchRows?.length) return []

  const boldMatchIds = (matchRows as { bold_match_id: number }[])
    .map((r) => r.bold_match_id)
    .filter((id): id is number => id != null)

  if (!boldMatchIds.length) return []

  const matchByBoldId = new Map<number, number>()
  for (const m of matchRows) {
    const boldId = (m as { bold_match_id: number }).bold_match_id
    if (boldId != null) matchByBoldId.set(boldId, m.id)
  }

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

      const matchId = matchByBoldId.get(match.id)
      if (!matchId) continue

      const status = mapStatus(match.status_type)
      if (status === 'scheduled') continue

      results.push({
        match_id: matchId,
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
