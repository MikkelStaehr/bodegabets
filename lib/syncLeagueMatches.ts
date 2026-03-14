/**
 * syncLeagueMatches.ts — nyt skema (tournaments, seasons, teams, matches, rounds)
 *
 * runLeagueSync() — Daglig cron: henter fixtures fra Bold API per sæson,
 * upsert til matches (via teams FK) og rounds.
 */

import { supabaseAdmin } from '@/lib/supabase'

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

const BOLD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
  'Referer': 'https://www.bold.dk/',
  'Origin': 'https://www.bold.dk',
} as const

type BoldMatchItem = {
  match: {
    id: number
    phase_id?: number
    round: string
    date: string
    home_team: { id: number; name?: string; score?: number | null }
    away_team: { id: number; name?: string; score?: number | null }
    status_type: string
    status_short?: string
    paused?: boolean
  }
}

export type SyncResult = {
  season_id: number
  tournament_id: number
  synced: number
  matches_created: number
  matches_updated: number
  rounds_upserted: number
  errors: string[]
}

function parseKickoff(dateStr: string): string {
  if (!dateStr) return new Date().toISOString()
  const m = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/)
  if (m) {
    return `${m[1]}T${m[2].padStart(2, '0')}:${m[3]}:00.000Z`
  }
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function mapStatus(statusType: string, statusShort?: string): 'scheduled' | 'live' | 'halftime' | 'finished' {
  if (statusType === 'finished') return 'finished'
  if (statusType === 'inprogress') return statusShort === 'HT' ? 'halftime' : 'live'
  return 'scheduled'
}

export async function runLeagueSync(): Promise<SyncResult[]> {
  const { data: seasons, error: seasonsError } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament_id, bold_phase_id, tournaments(bold_slug)')
    .eq('is_active', true)
    .not('bold_phase_id', 'is', null)

  if (seasonsError) {
    console.error('[syncLeagueMatches] seasons fetch:', seasonsError.message)
    return []
  }

  if (!seasons?.length) {
    console.log('[syncLeagueMatches] Ingen aktive sæsoner med bold_phase_id')
    return []
  }

  const results: SyncResult[] = []

  for (const season of seasons ?? []) {
    const boldPhaseId = season.bold_phase_id
    const result: SyncResult = {
      season_id: season.id,
      tournament_id: season.tournament_id,
      synced: 0,
      matches_created: 0,
      matches_updated: 0,
      rounds_upserted: 0,
      errors: [],
    }

    try {
      const allMatches: BoldMatchItem[] = []
      let page = 1
      const limit = 50
      let totalPageCount = 1

      while (true) {
        const offset = (page - 1) * limit
        const url = `${BOLD_MATCHES_API}?phase_ids=${boldPhaseId}&page=${page}&limit=${limit}&offset=${offset}`
        const res = await fetch(url, { headers: BOLD_HEADERS, cache: 'no-store' })

        if (!res.ok) {
          const text = await res.text()
          result.errors.push(`Bold API ${res.status}: ${text.slice(0, 200)}`)
          break
        }

        let text = ''
        let data: { matches?: BoldMatchItem[]; total_page_count?: number }
        try {
          text = await res.text()
          data = JSON.parse(text) as { matches?: BoldMatchItem[]; total_page_count?: number }
        } catch (err) {
          result.errors.push(`Bold API JSON fejl: ${String(err)} — ${text?.slice(0, 300)}`)
          break
        }

        const pageMatches = data.matches ?? []
        allMatches.push(...pageMatches)

        if (page === 1 && data.total_page_count != null) {
          totalPageCount = typeof data.total_page_count === 'number'
            ? data.total_page_count
            : parseInt(String(data.total_page_count), 10) || 1
        }

        if (page >= totalPageCount || page > 20) break
        page++
      }

      if (allMatches.length === 0) {
        results.push(result)
        continue
      }

      const seenMatchIds = new Set<number>()
      const uniqueMatches = allMatches.filter((m) => {
        const id = m.match?.id
        if (id == null) return false
        if (seenMatchIds.has(id)) return false
        seenMatchIds.add(id)
        return true
      })

      const boldHomeIds = [...new Set(uniqueMatches.map((m) => m.match.home_team?.id).filter((id): id is number => id != null))]
      const boldAwayIds = [...new Set(uniqueMatches.map((m) => m.match.away_team?.id).filter((id): id is number => id != null))]
      const allBoldTeamIds = [...new Set([...boldHomeIds, ...boldAwayIds])]

      const { data: teams } = await supabaseAdmin
        .from('teams')
        .select('id, bold_id')
        .in('bold_id', allBoldTeamIds)

      const teamByBoldId = new Map<number, number>()
      for (const t of teams ?? []) {
        teamByBoldId.set(t.bold_id, t.id)
      }

      const roundData = new Map<string, { minKickoff: string }>()
      const toUpsert: Array<{
        season_id: number
        home_team_id: number
        away_team_id: number
        round_name: string
        kickoff_at: string
        home_score: number | null
        away_score: number | null
        status: string
        bold_match_id: number
      }> = []

      for (const m of uniqueMatches) {
        const mt = m.match
        const homeBoldId = mt.home_team?.id
        const awayBoldId = mt.away_team?.id

        const homeTeamId = homeBoldId != null ? teamByBoldId.get(homeBoldId) : null
        const awayTeamId = awayBoldId != null ? teamByBoldId.get(awayBoldId) : null

        if (homeTeamId == null || awayTeamId == null) {
          console.warn(`[syncLeagueMatches] Hold ikke fundet i teams: bold_id ${homeBoldId ?? '?'} / ${awayBoldId ?? '?'} — skipper kamp ${mt.id}`)
          continue
        }

        const kickoffAt = parseKickoff(mt.date)
        const roundName = mt.round?.trim() || 'Ukendt runde'
        const homeScore = mt.home_team?.score ?? null
        const awayScore = mt.away_team?.score ?? null
        const hasScores = homeScore != null && awayScore != null

        let status = mapStatus(mt.status_type, mt.status_short)
        if (status === 'scheduled' && hasScores) status = 'finished'
        if (new Date(kickoffAt) > new Date() && status !== 'scheduled') status = 'scheduled'

        if (!roundData.has(roundName)) {
          roundData.set(roundName, { minKickoff: kickoffAt })
        } else {
          const r = roundData.get(roundName)!
          if (kickoffAt < r.minKickoff) r.minKickoff = kickoffAt
        }

        toUpsert.push({
          season_id: season.id,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          round_name: roundName,
          kickoff_at: kickoffAt,
          home_score: hasScores ? homeScore : null,
          away_score: hasScores ? awayScore : null,
          status,
          bold_match_id: mt.id,
        })
      }

      if (toUpsert.length === 0) {
        results.push(result)
        continue
      }

      const { data: existingMatches } = await supabaseAdmin
        .from('matches')
        .select('id, bold_match_id')
        .in('bold_match_id', toUpsert.map((r) => r.bold_match_id))

      const existingByBoldId = new Map((existingMatches ?? []).map((m) => [m.bold_match_id, m.id]))

      const roundsToUpsert = [...roundData.entries()].map(([name, { minKickoff }]) => ({
        season_id: season.id,
        name,
        betting_closes_at: minKickoff,
      }))

      const { error: roundsError } = await supabaseAdmin
        .from('rounds')
        .upsert(roundsToUpsert, { onConflict: 'season_id,name', ignoreDuplicates: false })

      if (roundsError) {
        result.errors.push(`Rounds upsert: ${roundsError.message}`)
      } else {
        result.rounds_upserted = roundsToUpsert.length
      }

      const { data: rounds } = await supabaseAdmin
        .from('rounds')
        .select('id, name')
        .eq('season_id', season.id)

      const roundIdByName = new Map((rounds ?? []).map((r) => [r.name, r.id]))

      const matchRows = toUpsert
        .map((r) => {
          const roundId = roundIdByName.get(r.round_name)
          return {
            season_id: r.season_id,
            round_id: roundId ?? null,
            home_team_id: r.home_team_id,
            away_team_id: r.away_team_id,
            round_name: r.round_name,
            kickoff_at: r.kickoff_at,
            home_score: r.home_score,
            away_score: r.away_score,
            status: r.status,
            bold_match_id: r.bold_match_id,
            updated_at: new Date().toISOString(),
          }
        })
        .filter((r) => r.round_id != null)

      for (const row of matchRows) {
        const existed = existingByBoldId.has(row.bold_match_id)
        const { error } = await supabaseAdmin
          .from('matches')
          .upsert(row, { onConflict: 'bold_match_id' })

        if (error) {
          result.errors.push(`Match ${row.bold_match_id}: ${error.message}`)
        } else {
          result.synced++
          if (existed) result.matches_updated++
          else result.matches_created++
        }
      }

      console.log(`[syncLeagueMatches] sæson ${season.id}: ${result.synced} kampe, ${result.matches_created} nye, ${result.matches_updated} opdateret, ${result.rounds_upserted} runder`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(msg)
      console.error(`[syncLeagueMatches] sæson ${season.id}:`, err)
    }

    results.push(result)
  }

  return results
}

/** Synkroniser én sæson (til admin sync-test) */
export async function syncSeasonFixtures(
  seasonId: number
): Promise<{ synced: number; errors: string[]; matches_created: number; matches_updated: number; rounds_upserted: number }> {
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament_id, bold_phase_id')
    .eq('id', seasonId)
    .single()

  if (!season?.bold_phase_id) {
    return { synced: 0, errors: [`Sæson ${seasonId} mangler bold_phase_id`], matches_created: 0, matches_updated: 0, rounds_upserted: 0 }
  }

  const results = await runLeagueSync()
  const r = results.find((x) => x.season_id === seasonId)
  if (!r) return { synced: 0, errors: [], matches_created: 0, matches_updated: 0, rounds_upserted: 0 }

  return {
    synced: r.synced,
    errors: r.errors,
    matches_created: r.matches_created,
    matches_updated: r.matches_updated,
    rounds_upserted: r.rounds_upserted,
  }
}
