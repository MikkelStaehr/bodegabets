/**
 * fixtureDownload.ts
 * Henter kampprogrammer fra fixturedownload.com's JSON feed.
 * URL: https://fixturedownload.com/feed/csv/{slug}
 * Trods "/csv" i URL'en returnerer endpointet JSON.
 *
 * JSON format: [{ RoundNumber, DateUtc, HomeTeam, AwayTeam, HomeTeamScore, AwayTeamScore, ... }]
 * DateUtc format: "2025-08-15 19:00:00Z" (UTC — konverteres til ISO 8601)
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getFixtures, getResults, danishTimeToUtc } from '@/lib/boldApi'
import { logAdmin } from '@/lib/adminLogs'

const BASE_URL = 'https://fixturedownload.com/feed/csv'

export interface FixtureRow {
  round_name: string
  home_team: string
  away_team: string
  kickoff_at: string        // ISO 8601 UTC
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'finished'
}

interface FDMatch {
  MatchNumber: number
  RoundNumber: number
  DateUtc: string
  Location: string
  HomeTeam: string
  AwayTeam: string
  Group: string | null
  HomeTeamScore: number | null
  AwayTeamScore: number | null
}

export async function fetchFixtures(slug: string): Promise<FixtureRow[]> {
  const url = `${BASE_URL}/${slug}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ved hentning af ${url}`)
  }

  const data: FDMatch[] = await res.json()
  return parseFixtures(data)
}

function parseFixtures(data: FDMatch[]): FixtureRow[] {
  return data
    .filter((m) => m.HomeTeam && m.AwayTeam && m.DateUtc)
    .map((m) => {
      // "2025-08-15 19:00:00Z" → "2025-08-15T19:00:00Z"
      const kickoff_at = m.DateUtc.replace(' ', 'T')

      const finished = m.HomeTeamScore !== null && m.AwayTeamScore !== null

      return {
        round_name:  `${m.RoundNumber}. runde`,
        home_team:   m.HomeTeam,
        away_team:   m.AwayTeam,
        kickoff_at,
        home_score:  finished ? m.HomeTeamScore : null,
        away_score:  finished ? m.AwayTeamScore : null,
        status:      finished ? 'finished' : 'scheduled',
      }
    })
}

export async function syncLeagueFixtures(leagueId: number): Promise<{
  synced: number
  errors: string[]
}> {
  const errors: string[] = []

  const { data: league } = await supabaseAdmin
    .from('leagues')
    .select('id, name, fixturedownload_slug, bold_slug')
    .eq('id', leagueId)
    .single()

  if (!league) {
    return { synced: 0, errors: [`Liga ${leagueId} ikke fundet`] }
  }

  await supabaseAdmin
    .from('leagues')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('id', leagueId)

  let fixtures: FixtureRow[] = []
  let source = 'fixturedownload'

  if (league.fixturedownload_slug) {
    // Primær kilde: fixturedownload.com
    try {
      fixtures = await fetchFixtures(league.fixturedownload_slug)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ukendt fejl'
      await supabaseAdmin
        .from('leagues')
        .update({ sync_status: 'error', sync_error: msg })
        .eq('id', leagueId)
      await logSync(leagueId, 0, 'error', msg)
      await logAdmin('bold_api', 'error', `${league.name}: ${msg}`, { league_id: leagueId })
      return { synced: 0, errors: [msg] }
    }
  } else if (league.bold_slug) {
    // Fallback: Bold.dk (bruges fx til Superligaen)
    source = 'bold.dk'
    try {
      const [rawFixtures, rawResults] = await Promise.all([
        getFixtures(league.bold_slug),
        getResults(league.bold_slug),
      ])

      // Kommende kampe
      for (const f of rawFixtures) {
        if (!f.round) continue
        fixtures.push({
          round_name: f.round.includes('runde') ? f.round : `${f.round}. runde`,
          home_team:  f.home_team,
          away_team:  f.away_team,
          kickoff_at: danishTimeToUtc(f.date, f.kickoff_time),
          home_score: null,
          away_score: null,
          status:     'scheduled',
        })
      }

      // Seneste resultater
      for (const r of rawResults) {
        if (!r.round) continue
        fixtures.push({
          round_name: r.round.includes('runde') ? r.round : `${r.round}. runde`,
          home_team:  r.home_team,
          away_team:  r.away_team,
          kickoff_at: danishTimeToUtc(r.date, '15:00'), // Bold.dk giver ikke historiske tider
          home_score: r.home_score,
          away_score: r.away_score,
          status:     'finished',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ukendt fejl fra Bold.dk'
      await supabaseAdmin
        .from('leagues')
        .update({ sync_status: 'error', sync_error: msg })
        .eq('id', leagueId)
      await logSync(leagueId, 0, 'error', msg)
      await logAdmin('bold_api', 'error', `${league.name}: ${msg}`, { league_id: leagueId })
      return { synced: 0, errors: [msg] }
    }
  } else {
    const msg = 'Ingen datakilde konfigureret (hverken fixturedownload_slug eller bold_slug)'
    await supabaseAdmin
      .from('leagues')
      .update({ sync_status: 'error', sync_error: msg })
      .eq('id', leagueId)
    await logSync(leagueId, 0, 'error', msg)
    await logAdmin('bold_api', 'error', `${league.name}: ${msg}`, { league_id: leagueId })
    return { synced: 0, errors: [msg] }
  }

  if (!fixtures.length) {
    const msg = `Ingen kampe fundet fra ${source}`
    await supabaseAdmin
      .from('leagues')
      .update({ sync_status: 'error', sync_error: msg })
      .eq('id', leagueId)
    await logSync(leagueId, 0, 'error', msg)
    await logAdmin('bold_api', 'error', `${league.name}: ${msg}`, { league_id: leagueId })
    return { synced: 0, errors: [msg] }
  }

  const rows = fixtures.map((f) => ({
    league_id:  leagueId,
    round_name: f.round_name,
    home_team:  f.home_team,
    away_team:  f.away_team,
    kickoff_at: f.kickoff_at,
    home_score: f.home_score,
    away_score: f.away_score,
    status:     f.status,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin
    .from('league_matches')
    .upsert(rows, { onConflict: 'league_id,home_team,away_team,kickoff_at' })

  if (error) {
    await supabaseAdmin
      .from('leagues')
      .update({ sync_status: 'error', sync_error: error.message })
      .eq('id', leagueId)
    await logSync(leagueId, 0, 'error', error.message)
    await logAdmin('bold_api', 'error', `${league.name}: ${error.message}`, { league_id: leagueId })
    return { synced: 0, errors: [error.message] }
  }

  await supabaseAdmin
    .from('leagues')
    .update({
      sync_status:    'ok',
      sync_error:     null,
      last_synced_at: new Date().toISOString(),
      total_matches:  fixtures.length,
    })
    .eq('id', leagueId)

  await logSync(leagueId, fixtures.length, 'ok', `${fixtures.length} kampe importeret fra ${source}`)
  await logAdmin('bold_api', 'success', `${league.name}: ${fixtures.length} kampe fra ${source}`, {
    league_id: leagueId,
    synced: fixtures.length,
    source,
  })
  console.log(`[fixtureDownload] ${league.name}: ${fixtures.length} kampe synket fra ${source}`)
  return { synced: fixtures.length, errors }
}

async function logSync(
  leagueId: number,
  matchesImported: number,
  status: 'ok' | 'error',
  message: string
) {
  await supabaseAdmin
    .from('league_sync_logs')
    .insert({ league_id: leagueId, matches_imported: matchesImported, status, message })
}
