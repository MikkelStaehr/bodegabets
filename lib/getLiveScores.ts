/**
 * getLiveScores.ts
 * Henter live scores fra Bold API for alle kampe i en runde.
 *
 * Bold API: GET .../matches?team_ids={home_bold_team_id}&phase_ids={bold_phase_id}&limit=50
 * Returnerer ~38 kampe. Find kampen: away_team.id === away_bold_team_id
 */

import { supabaseAdmin } from '@/lib/supabase'

const BOLD_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

export type LiveScoreResult = {
  league_match_id: number
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'finished'
  minute: number | null
  bold_match_id: number | null
}

type BoldApiMatch = {
  match: {
    id: number
    status_type: 'notstarted' | 'live' | 'finished'
    time: number | null
    home_team: { id: number; name: string; score: number }
    away_team: { id: number; name: string; score: number }
  }
}

type BoldApiResponse = {
  matches?: BoldApiMatch[]
}

function mapStatus(statusType: string): LiveScoreResult['status'] {
  if (statusType === 'live' || statusType === 'inprogress') return 'live'
  if (statusType === 'finished') return 'finished'
  return 'scheduled'
}

async function fetchBoldMatchesForTeam(
  homeBoldTeamId: number,
  boldPhaseId: number
): Promise<BoldApiMatch['match'][]> {
  const params = new URLSearchParams({
    team_ids: String(homeBoldTeamId),
    phase_ids: String(boldPhaseId),
    limit: '50',
  })

  const url = `${BOLD_API}?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'BodegaBets/1.0',
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bold API fejl: ${res.status} ${text}`)
  }

  let data: BoldApiResponse
  try {
    data = await res.json()
  } catch {
    throw new Error('Bold API returnerede ikke valid JSON')
  }

  return (data.matches ?? []).map((m) => m.match)
}

export async function getLiveScores(roundId: number): Promise<LiveScoreResult[]> {
  // 1. Hent matches for round_id (med league_match_id til Bold-lookup)
  const { data: matchRows } = await supabaseAdmin
    .from('matches')
    .select('id, league_match_id')
    .eq('round_id', roundId)
    .not('league_match_id', 'is', null)
    .or('is_excluded.is.null,is_excluded.eq.false')

  if (!matchRows?.length) return []

  const leagueMatchIds = (matchRows as { league_match_id: number }[])
    .map((r) => r.league_match_id)
    .filter((id): id is number => id != null)

  // Hent league_matches for disse IDs
  const { data: leagueMatches } = await supabaseAdmin
    .from('league_matches')
    .select('id, home_team, away_team, league_id')
    .in('id', leagueMatchIds)

  if (!leagueMatches?.length) return []

  const lmById = new Map(
    (leagueMatches as { id: number; home_team: string; away_team: string; league_id: number }[]).map((lm) => [lm.id, lm])
  )

  const withLeagueMatch = leagueMatchIds
    .map((leagueMatchId) => ({ leagueMatchId, lm: lmById.get(leagueMatchId) }))
    .filter((r): r is { leagueMatchId: number; lm: { id: number; home_team: string; away_team: string; league_id: number } } => r.lm != null)

  if (withLeagueMatch.length === 0) return []

  const leagueIds = [...new Set(withLeagueMatch.map((r) => r.lm.league_id))]

  // 2. Hent bold_phase_id for ligaer
  const { data: leagues } = await supabaseAdmin
    .from('leagues')
    .select('id, bold_phase_id')
    .in('id', leagueIds)
    .not('bold_phase_id', 'is', null)

  const phaseByLeague = new Map(
    (leagues ?? []).map((l) => [(l as { id: number }).id, (l as { bold_phase_id: number }).bold_phase_id])
  )

  // 3. Hent team_xref — bb_team_name + league_id → bold_team_id
  const teamNames = new Set<string>()
  for (const r of withLeagueMatch) {
    teamNames.add(r.lm.home_team)
    teamNames.add(r.lm.away_team)
  }

  const { data: teamXrefRows } = await supabaseAdmin
    .from('team_xref')
    .select('bb_league_id, bb_team_name, bold_team_id')
    .in('bb_team_name', [...teamNames])
    .not('bold_team_id', 'is', null)

  const teamToBoldId = new Map<string, number>()
  for (const t of teamXrefRows ?? []) {
    const row = t as { bb_league_id: number; bb_team_name: string; bold_team_id: number }
    if (leagueIds.includes(row.bb_league_id)) {
      teamToBoldId.set(`${row.bb_league_id}:${row.bb_team_name}`, row.bold_team_id)
    }
  }

  // 4. Cache for Bold API kald (homeBoldId + phaseId → matches)
  const fetchCache = new Map<string, BoldApiMatch['match'][]>()
  const cacheKey = (homeId: number, phaseId: number) => `${homeId}:${phaseId}`

  async function getBoldMatches(homeBoldId: number, boldPhaseId: number): Promise<BoldApiMatch['match'][]> {
    const key = cacheKey(homeBoldId, boldPhaseId)
    let matches = fetchCache.get(key)
    if (matches === undefined) {
      try {
        matches = await fetchBoldMatchesForTeam(homeBoldId, boldPhaseId)
        fetchCache.set(key, matches)
      } catch (err) {
        console.error('[getLiveScores] Bold API fejl for', homeBoldId, boldPhaseId, err)
        matches = []
        fetchCache.set(key, matches)
      }
    }
    return matches
  }

  // 5. For hvert league_match: hent Bold data og map til LiveScoreResult
  const promises = withLeagueMatch.map(async (r) => {
    const lm = r.lm
    const leagueMatchId = r.leagueMatchId
    const homeBoldId = teamToBoldId.get(`${lm.league_id}:${lm.home_team}`)
    const awayBoldId = teamToBoldId.get(`${lm.league_id}:${lm.away_team}`)
    const boldPhaseId = phaseByLeague.get(lm.league_id)

    if (homeBoldId == null || awayBoldId == null || boldPhaseId == null) {
      return null
    }

    const matches = await getBoldMatches(homeBoldId, boldPhaseId)
    const boldMatch = matches.find((m) => m.away_team.id === awayBoldId) ?? null

    if (!boldMatch) {
      return {
        league_match_id: leagueMatchId,
        home_score: null,
        away_score: null,
        status: 'scheduled' as const,
        minute: null,
        bold_match_id: null,
      }
    }

    return {
      league_match_id: leagueMatchId,
      home_score: boldMatch.home_team.score,
      away_score: boldMatch.away_team.score,
      status: mapStatus(boldMatch.status_type),
      minute: boldMatch.time ?? null,
      bold_match_id: boldMatch.id,
    }
  })

  const results = await Promise.all(promises)
  return results.filter((r): r is LiveScoreResult => r != null)
}
