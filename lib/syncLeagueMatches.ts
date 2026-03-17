/**
 * syncLeagueMatches.ts
 *
 * syncResults(seasonId, boldSlug)
 *   Henter seneste resultater fra Bold.dk og opdaterer scores i league_matches.
 *   Køres dagligt via cron.
 *
 * buildLeagueRounds(seasonId)
 *   Opretter/opdaterer runder og matches for en sæson fra league_matches.
 *   Forudsætter at league_matches er populeret (via admin-sync).
 *
 * runLeagueSync()
 *   Daglig cron: opdaterer resultater + bygger runder for alle aktive sæsoner.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getResults, danishTimeToUtc } from '@/lib/boldApi'
import { findBestTeamMatch } from '@/lib/teamNameNormalizer'

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

// ─── Typer ────────────────────────────────────────────────────────────────────

export type SyncResult = {
  season_id:       number
  synced:          number
  rounds_created:  number
  matches_created: number
  matches_updated: number
  errors:          string[]
}

// ─── 1. Resultater fra Bold.dk API (live, pauseresultater, slutresultater) ─────

export async function syncResults(
  seasonId: number,
  boldSlug: string
): Promise<Pick<SyncResult, 'synced' | 'errors'>> {
  const errors: string[] = []
  const results = await getResults(boldSlug)

  if (!results.length) return { synced: 0, errors: [] }

  let synced = 0

  // Gruppér resultater per dato for batch-hentning
  const byDate = new Map<string, typeof results>()
  for (const r of results) {
    if (!r.date) continue
    const list = byDate.get(r.date) ?? []
    list.push(r)
    byDate.set(r.date, list)
  }

  for (const [dateStr, dateResults] of byDate) {
    const { data: allMatches } = await supabaseAdmin
      .from('league_matches')
      .select('id, home_team, away_team, status, bold_match_id')
      .eq('season_id', seasonId)
      .gte('kickoff', `${dateStr}T00:00:00Z`)
      .lte('kickoff', `${dateStr}T23:59:59Z`)

    const candidates = (allMatches ?? []) as Array<{
      id: number
      home_team: string
      away_team: string
      status: string
      bold_match_id: number | null
    }>

    const byBoldId = new Map<number, (typeof candidates)[0]>()
    for (const m of candidates) {
      if (m.bold_match_id != null) byBoldId.set(m.bold_match_id, m)
    }

    for (const r of dateResults) {
      // Forsøg 1: direkte bold_match_id match (hurtig og præcis)
      const existingByBold = byBoldId.get(r.bold_match_id)
      if (existingByBold) {
        if (existingByBold.status === 'finished') continue

        const { error } = await supabaseAdmin
          .from('league_matches')
          .update({
            home_score: r.home_score,
            away_score: r.away_score,
            status: r.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByBold.id)

        if (error) {
          errors.push(`${r.home_team} vs ${r.away_team}: ${error.message}`)
        } else {
          synced++
        }
        continue
      }

      // Forsøg 2: navn + dato fallback (for kampe uden bold_match_id endnu)
      const dbHomeNames = [...new Set(candidates.map((m) => m.home_team))]
      const dbAwayNames = [...new Set(candidates.map((m) => m.away_team))]

      const resolvedHome = findBestTeamMatch(r.home_team, dbHomeNames)
      const resolvedAway = findBestTeamMatch(r.away_team, dbAwayNames)

      if (!resolvedHome || !resolvedAway) {
        console.warn(`[syncResults] Ingen match for: ${r.home_team} vs ${r.away_team}`)
        continue
      }

      const existing = candidates.find(
        (m) => m.home_team === resolvedHome && m.away_team === resolvedAway
      )

      if (!existing) continue
      if (existing.status === 'finished') continue

      const { error } = await supabaseAdmin
        .from('league_matches')
        .update({
          home_score: r.home_score,
          away_score: r.away_score,
          status: r.status,
          updated_at: new Date().toISOString(),
          bold_match_id: r.bold_match_id, // Gem så vi bruger direkte match næste gang
        })
        .eq('id', existing.id)

      if (error) {
        errors.push(`${r.home_team} vs ${r.away_team}: ${error.message}`)
      } else {
        synced++
      }
    }
  }

  console.log(`[syncResults] ${synced} resultater opdateret for sæson ${seasonId}`)
  return { synced, errors }
}

// ─── 1b. Fixtures fra Bold API (phase_ids) ────────────────────────────────────

type BoldMatchItem = {
  match: {
    id: number
    round: string
    date: string
    home_team: { name: string; score?: number | null }
    away_team: { name: string; score?: number | null }
    status_type: string
    paused?: boolean
  }
}

/**
 * Henter fixtures fra Bold API via phase_ids og upsert til league_matches.
 * Bruges for alle sæsoner med bold_phase_id (Bold.dk er eneste datakilde).
 */
export type SyncBoldFixturesPreview = Array<{
  season_id: number
  round_name: string
  home_team: string
  away_team: string
  kickoff: string
  home_score: number | null
  away_score: number | null
  status: string
  bold_match_id: number
}>

export async function syncBoldFixtures(
  seasonId: number,
  boldPhaseId: number,
  options?: { dryRun?: boolean }
): Promise<{ synced: number; errors: string[]; preview?: SyncBoldFixturesPreview; raw_bold_response?: BoldMatchItem[] }> {
  const dryRun = options?.dryRun ?? false
  const errors: string[] = []

  const allMatches: BoldMatchItem[] = []
  const limit = 50
  let page = 1
  let totalPageCount = 1

  while (true) {
    const offset = (page - 1) * limit
    const url = `${BOLD_MATCHES_API}?phase_ids=${boldPhaseId}&page=${page}&limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BodegaBets/1.0',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text()
      errors.push(`Bold API fejl ${res.status}: ${text.slice(0, 200)}`)
      break
    }
    let data: { matches?: BoldMatchItem[]; total_page_count?: number }
    try {
      data = await res.json()
    } catch {
      errors.push('Bold API returnerede ikke valid JSON')
      break
    }
    const pageMatches = data.matches ?? []
    allMatches.push(...pageMatches)
    const rawTotal = data.total_page_count
    if (page === 1 && rawTotal != null) {
      totalPageCount = typeof rawTotal === 'number' ? rawTotal : parseInt(String(rawTotal), 10) || 1
    }
    console.log(`[Sæson ${seasonId}] side ${page}/${totalPageCount} — ${pageMatches.length} kampe`)
    if (page >= totalPageCount) break
    if (page > 20) break // Safety: ingen sæson har mere end 1000 kampe
    page++
  }

  // Deduplikér på Bold match ID inden videre processering (samme kamp kan optræde på flere sider)
  const seen = new Set<number>()
  const uniqueMatches = allMatches.filter((entry) => {
    const id = entry.match?.id
    if (id == null) return true // behold hvis ingen id (skal ikke ske)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  const matches = uniqueMatches
  if (!matches.length) {
    return { synced: 0, errors: [] }
  }

  const rows = matches.map((m) => {
    const mt = m.match
    const { date, time } = (() => {
      const ma = mt.date.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/)
      if (ma) return { date: ma[1], time: `${ma[2].padStart(2, '0')}:${ma[3]}` }
      const d = mt.date.slice(0, 10)
      return { date: d, time: '15:00' }
    })()
    const kickoff = danishTimeToUtc(date, time)

    const finished = mt.status_type === 'finished'
    const homeScore = mt.home_team?.score ?? null
    const awayScore = mt.away_team?.score ?? null
    const hasScores = homeScore != null && awayScore != null

    let status: 'scheduled' | 'live' | 'halftime' | 'finished' = 'scheduled'
    if (finished) {
      status = 'finished'
    } else if (mt.status_type === 'inprogress') {
      status = mt.paused ? 'halftime' : 'live'
    } else if (hasScores) {
      status = 'finished'
    }

    const round_name = mt.round?.includes('runde') ? mt.round : mt.round ? `${mt.round}. runde` : 'Ukendt runde'

    // Aldrig sæt fremtidige kampe til finished/live/halftime
    if (new Date(kickoff) > new Date()) {
      status = 'scheduled'
    }

    return {
      season_id: seasonId,
      round_name,
      home_team: mt.home_team?.name ?? '',
      away_team: mt.away_team?.name ?? '',
      kickoff,
      home_score: hasScores ? homeScore : null,
      away_score: hasScores ? awayScore : null,
      status,
      bold_match_id: mt.id,
      updated_at: new Date().toISOString(),
    }
  }).filter((r) => r.home_team && r.away_team)

  if (!dryRun) {
    const { error } = await supabaseAdmin
      .from('league_matches')
      .upsert(rows, { onConflict: 'bold_match_id' })

    if (error) {
      return { synced: 0, errors: [error.message] }
    }
  }

  const preview: SyncBoldFixturesPreview = rows.map((r) => ({
    season_id: r.season_id,
    round_name: r.round_name,
    home_team: r.home_team,
    away_team: r.away_team,
    kickoff: r.kickoff,
    home_score: r.home_score,
    away_score: r.away_score,
    status: r.status,
    bold_match_id: r.bold_match_id,
  }))

  console.log(`[syncBoldFixtures] sæson ${seasonId}: ${rows.length} kampe fra Bold API (phase_id=${boldPhaseId})${dryRun ? ' (dry-run)' : ''}`)
  return dryRun
    ? { synced: rows.length, errors, preview, raw_bold_response: allMatches }
    : { synced: rows.length, errors }
}

/** Synkroniser en sæson via Bold API. Kræver bold_phase_id på seasons. */
export async function syncSeasonViaBold(seasonId: number): Promise<{ synced: number; errors: string[] }> {
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('bold_phase_id')
    .eq('id', seasonId)
    .single()

  if (!season?.bold_phase_id) {
    return { synced: 0, errors: [`Sæson ${seasonId} mangler bold_phase_id`] }
  }
  return syncBoldFixtures(seasonId, season.bold_phase_id)
}

// ─── 2. Opbyg runder + matches for en sæson fra league_matches ────────────────
// Optimeret: maks 6 DB-kald uanset antal kampe/runder (batch insert/update)

export type BuildGameRoundsResult = BuildLeagueRoundsResult
export type BuildLeagueRoundsResult = Pick<SyncResult, 'rounds_created' | 'matches_created' | 'matches_updated'> & {
  debug?: {
    rounds_matched: number
    rounds_skipped: number
    to_insert: number
    round_names_sample?: string[]
    db_round_names_sample?: string[]
  }
}

/** @deprecated Brug buildLeagueRounds(seasonId) i stedet */
export const buildGameRounds = (_gameId: number, seasonId: number) => buildLeagueRounds(seasonId)

export async function buildLeagueRounds(
  seasonId: number
): Promise<BuildLeagueRoundsResult> {
  const stats = { rounds_created: 0, matches_created: 0, matches_updated: 0 }

  type LM = {
    id: number; round_name: string; home_team: string; away_team: string
    kickoff: string; home_score: number | null; away_score: number | null; status: string
  }
  type ExRound = { id: number; name: string }
  type ExMatch = { id: number; home_team: string; away_team: string; status: string; season_id: number; round_name: string; league_match_id?: number | null }

  // 1. Hent alt data parallelt (2 queries)
  const [lmRes, roundRes] = await Promise.all([
    supabaseAdmin
      .from('league_matches')
      .select('id, round_name, home_team, away_team, kickoff, home_score, away_score, status')
      .eq('season_id', seasonId)
      .order('kickoff', { ascending: true }),
    supabaseAdmin
      .from('rounds')
      .select('id, name')
      .eq('season_id', seasonId),
  ])

  const leagueMatches  = (lmRes.data ?? []) as LM[]
  if (!leagueMatches.length) {
    console.log(`[buildLeagueRounds] sæson ${seasonId}: ingen league_matches`)
    return stats
  }

  const existingRounds = (roundRes.data ?? []) as ExRound[]

  // Hent matches via season_id
  let existingMatches: ExMatch[] = []
  {
    const { data } = await supabaseAdmin
      .from('matches')
      .select('id, home_team, away_team, status, season_id, round_name, league_match_id')
      .eq('season_id', seasonId)
    existingMatches = (data ?? []) as ExMatch[]
  }

  // 2. Byg lookup-maps (roundMap + roundByNumber som fallback ved navne-mismatch)
  const roundMap = new Map<string, number>()
  const roundByNumber = new Map<number, number>()
  for (const r of existingRounds) {
    roundMap.set(r.name, r.id)
    if (r.name !== r.name.toLowerCase()) roundMap.set(r.name.toLowerCase(), r.id)
    const num = parseInt(r.name.replace(/\D/g, ''), 10) || 0
    if (num) roundByNumber.set(num, r.id)
  }

  function getRoundId(name: string): number | undefined {
    const exact = roundMap.get(name) ?? roundMap.get(name.toLowerCase())
    if (exact) return exact
    const num = parseInt(name.replace(/\D/g, ''), 10) || 0
    return num ? roundByNumber.get(num) : undefined
  }

  const matchByLmId     = new Map<number, ExMatch>(
    existingMatches.filter((m) => m.league_match_id != null).map((m) => [m.league_match_id!, m])
  )
  const matchByPair     = new Map<string, ExMatch>(existingMatches.map((m) => [`${m.round_name}|${m.home_team}|${m.away_team}`, m]))

  // 3. Gruppér kampe per runde
  const groups = new Map<string, LM[]>()
  for (const m of leagueMatches) {
    if (!groups.has(m.round_name)) groups.set(m.round_name, [])
    groups.get(m.round_name)!.push(m)
  }

  // 4. Batch-insert nye runder (1 query)
  const newRoundNames = [...groups.keys()].filter((name) => !getRoundId(name))
  if (newRoundNames.length) {
    const roundRows = newRoundNames.map((name) => {
      const matches = groups.get(name)!
      const firstKickoff = matches.reduce<string | null>((min, m) => {
        if (!m.kickoff) return min
        return !min || m.kickoff < min ? m.kickoff : min
      }, null)
      return {
        season_id:         seasonId,
        name,
        status:            matches.every((m) => m.status === 'finished') ? 'finished' : 'upcoming',
        betting_closes_at: firstKickoff,
      }
    })

    const { data: inserted } = await supabaseAdmin
      .from('rounds')
      .insert(roundRows)
      .select('id, name')

    for (const r of (inserted ?? []) as ExRound[]) {
      roundMap.set(r.name, r.id)
      if (r.name !== r.name.toLowerCase()) roundMap.set(r.name.toLowerCase(), r.id)
      const num = parseInt(r.name.replace(/\D/g, ''), 10) || 0
      if (num) roundByNumber.set(num, r.id)
      stats.rounds_created++
    }
  }

  // 5. Byg upsert-rækker for alle kampe (scores + status kopieres altid fra league_matches)
  const toUpsert: object[] = []

  let roundsMatched = 0
  let roundsSkipped = 0
  const roundNamesSample: string[] = []

  for (const [roundName, roundMatches] of groups) {
    const roundId = getRoundId(roundName)
    if (!roundId) {
      roundsSkipped++
      if (roundNamesSample.length < 5) roundNamesSample.push(`"${roundName}" (ingen match)`)
      continue
    }
    roundsMatched++

    for (const lm of roundMatches) {
      const matchStatus =
        lm.status === 'finished' ? 'finished' : lm.status === 'halftime' ? 'halftime' : lm.status === 'live' ? 'live' : 'scheduled'
      toUpsert.push({
        season_id:       seasonId,
        round_name:      roundName,
        league_match_id: lm.id,
        home_team:       lm.home_team,
        away_team:       lm.away_team,
        kickoff:         lm.kickoff,
        home_score:      lm.home_score,
        away_score:      lm.away_score,
        status:          matchStatus,
      })
    }
  }

  // 6. Batch-upsert matches (scores + status opdateres altid fra league_matches)
  if (toUpsert.length) {
    const existingLmIds = new Set(existingMatches.filter((m) => m.league_match_id != null).map((m) => m.league_match_id!))
    console.log(`[buildLeagueRounds] sæson ${seasonId}: upsert ${toUpsert.length} matches`)
    for (let i = 0; i < toUpsert.length; i += 500) {
      const chunk = toUpsert.slice(i, i + 500)
      const { error } = await supabaseAdmin
        .from('matches')
        .upsert(chunk, { onConflict: 'league_match_id' })
      if (error) {
        console.error(`[buildLeagueRounds] match upsert fejlede (chunk ${i}–${i + 500}) for sæson ${seasonId}:`, error.message)
      } else {
        for (const row of chunk) {
          const lmId = (row as { league_match_id: number }).league_match_id
          if (existingLmIds.has(lmId)) {
            stats.matches_updated++
          } else {
            stats.matches_created++
          }
        }
      }
    }
  }

  const result: BuildLeagueRoundsResult = { ...stats }
  if (stats.matches_created === 0 && stats.matches_updated === 0) {
    const dbRoundSample = existingRounds.slice(0, 5).map((r) => `"${r.name}"`)
    result.debug = {
      rounds_matched: roundsMatched,
      rounds_skipped: roundsSkipped,
      to_insert: toUpsert.length,
      round_names_sample: roundNamesSample.length ? roundNamesSample : undefined,
      db_round_names_sample: dbRoundSample,
    }
  }
  return result
}

// ─── 3. Daglig cron: opdater resultater + byg runder ─────────────────────────

export async function runLeagueSync(): Promise<SyncResult[]> {
  // Hent ALLE sæsoner med bold_phase_id
  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('id, bold_phase_id, tournaments:tournament_id(name)')
    .not('bold_phase_id', 'is', null)

  if (!seasons?.length) {
    console.log('[sync-fixtures] Ingen sæsoner med bold_phase_id')
    return []
  }

  const results: SyncResult[] = []

  for (const season of seasons) {
    const tournaments = season.tournaments as unknown as { name: string } | null
    const name = tournaments?.name ?? `Sæson ${season.id}`
    let synced = 0
    const errors: string[] = []

    try {
      if (season.bold_phase_id) {
        const res = await syncBoldFixtures(season.id, season.bold_phase_id)
        synced = res.synced
        errors.push(...res.errors)
      } else {
        errors.push(`Ingen datakilde konfigureret for ${name} (bold_phase_id mangler)`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)
      console.error(`[sync-fixtures] ${name} (id=${season.id}): ${msg}`)
      results.push({
        season_id: season.id,
        synced: 0,
        rounds_created: 0,
        matches_created: 0,
        matches_updated: 0,
        errors,
      })
      continue
    }

    // Kør buildLeagueRounds for sæsonen
    const s = await buildLeagueRounds(season.id)
    const { rounds_created, matches_created, matches_updated } = s

    console.log(
      `[sync-fixtures] ${name} (id=${season.id}, bold_phase_id=${season.bold_phase_id}): ` +
        `${synced} kampe synket, ${matches_created} matches oprettet, ${matches_updated} opdateret` +
        (errors.length ? ` — ${errors.length} fejl` : '')
    )

    results.push({ season_id: season.id, synced, rounds_created, matches_created, matches_updated, errors })
  }

  return results
}

// ─── 4. Kort-interval cron: kun Bold resultater (live/halftime/finished) ────────

export async function runSyncResultsOnly(): Promise<SyncResult[]> {
  // Hent season_ids fra aktive spilrum via game_seasons
  const { data: activeGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('status', 'active')

  if (!activeGames?.length) return []

  const gameIds = activeGames.map((g) => g.id)
  const { data: gameSeasonRows } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .in('game_id', gameIds)

  if (!gameSeasonRows?.length) return []

  const seasonIds = [...new Set(gameSeasonRows.map((gs) => gs.season_id as number))]

  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('id, bold_phase_id, tournaments:tournament_id(name)')
    .in('id', seasonIds)
    .not('bold_phase_id', 'is', null)

  const results: SyncResult[] = []

  for (const season of (seasons ?? [])) {
    if (!season.bold_phase_id) continue

    const res = await syncBoldFixtures(season.id, season.bold_phase_id)
    const s = await buildLeagueRounds(season.id)

    results.push({
      season_id: season.id,
      synced: res.synced,
      rounds_created: s.rounds_created,
      matches_created: s.matches_created,
      matches_updated: s.matches_updated,
      errors: res.errors,
    })
  }

  return results
}
