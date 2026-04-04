/**
 * syncLeagueMatches.ts
 *
 * syncBoldFixtures(seasonId, boldPhaseId)
 *   Henter fixtures/resultater fra Bold.dk API og upsert direkte til
 *   matches + rounds tabellerne. Ingen mellemled (league_matches).
 *
 * syncSeasonViaBold(seasonId)
 *   Wrapper: henter bold_phase_id fra seasons og kalder syncBoldFixtures.
 *
 * runLeagueSync()
 *   Daglig cron: synkroniserer alle sæsoner med bold_phase_id.
 *
 * runSyncResultsOnly()
 *   Kort-interval cron: synkroniserer kun aktive sæsoner.
 */

import { supabaseAdmin } from '@/lib/supabase'

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

// ─── Bold API response type ──────────────────────────────────────────────────

type BoldMatchItem = {
  match: {
    id: number
    round: string
    date: string
    home_team: {
      id: number
      name: string
      slug: string
      score?: number | null
      image_name?: string | null
    }
    away_team: {
      id: number
      name: string
      slug: string
      score?: number | null
      image_name?: string | null
    }
    status_type: string
    paused?: boolean
  }
}

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

// ─── Team lookup/upsert ─────────────────────────────────────────────────────

const BOLD_CDN = 'https://bold.dk/img/tag/64x64'

async function resolveTeamId(
  boldTeam: { id: number; name: string; slug: string; image_name?: string | null },
  teamCache: Map<number, number>,
): Promise<number | null> {
  const cached = teamCache.get(boldTeam.id)
  if (cached) return cached

  // Lookup by bold_id
  const { data: existing } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('bold_id', boldTeam.id)
    .maybeSingle()

  if (existing) {
    teamCache.set(boldTeam.id, existing.id)
    return existing.id
  }

  // Upsert new team
  const logoUrl = boldTeam.image_name ? `${BOLD_CDN}/${boldTeam.image_name}` : null
  const { data: inserted, error } = await supabaseAdmin
    .from('teams')
    .insert({
      name: boldTeam.name,
      bold_id: boldTeam.id,
      slug: boldTeam.slug,
      logo_url: logoUrl,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    // May have been inserted concurrently — try lookup again
    const { data: retry } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('bold_id', boldTeam.id)
      .maybeSingle()
    if (retry) {
      teamCache.set(boldTeam.id, retry.id)
      return retry.id
    }
    return null
  }

  teamCache.set(boldTeam.id, inserted.id)
  return inserted.id
}

// ─── Batch-resolve all teams ────────────────────────────────────────────────

async function resolveAllTeams(
  matches: BoldMatchItem[],
  teamCache: Map<number, number>,
): Promise<void> {
  // Collect all unique bold team IDs
  const boldTeamIds = new Set<number>()
  const boldTeamInfo = new Map<number, { id: number; name: string; slug: string; image_name?: string | null }>()
  for (const m of matches) {
    const ht = m.match.home_team
    const at = m.match.away_team
    if (ht.id && !teamCache.has(ht.id)) {
      boldTeamIds.add(ht.id)
      boldTeamInfo.set(ht.id, ht)
    }
    if (at.id && !teamCache.has(at.id)) {
      boldTeamIds.add(at.id)
      boldTeamInfo.set(at.id, at)
    }
  }

  if (!boldTeamIds.size) return

  // Batch lookup existing teams
  const ids = [...boldTeamIds]
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { data: existing } = await supabaseAdmin
      .from('teams')
      .select('id, bold_id')
      .in('bold_id', chunk)

    for (const t of existing ?? []) {
      teamCache.set(t.bold_id, t.id)
      boldTeamIds.delete(t.bold_id)
    }
  }

  // Insert missing teams
  if (boldTeamIds.size) {
    const newTeams = [...boldTeamIds].map((boldId) => {
      const info = boldTeamInfo.get(boldId)!
      return {
        name: info.name,
        bold_id: info.id,
        slug: info.slug,
        logo_url: info.image_name ? `${BOLD_CDN}/${info.image_name}` : null,
      }
    })

    for (let i = 0; i < newTeams.length; i += 50) {
      const chunk = newTeams.slice(i, i + 50)
      const { data: inserted } = await supabaseAdmin
        .from('teams')
        .upsert(chunk, { onConflict: 'bold_id' })
        .select('id, bold_id')

      for (const t of inserted ?? []) {
        teamCache.set(t.bold_id, t.id)
      }
    }
  }
}

// ─── Danish timezone helper ─────────────────────────────────────────────────

function getLastSunday(year: number, month: number): number {
  const date = new Date(Date.UTC(year, month + 1, 0))
  return date.getUTCDate() - date.getUTCDay()
}

function isDanishSummerTime(date: Date): boolean {
  const month = date.getUTCMonth() // 0-indexed
  if (month > 2 && month < 9) return true
  if (month < 2 || month > 9) return false
  const lastSunday = getLastSunday(date.getUTCFullYear(), month)
  if (month === 2) return date.getUTCDate() >= lastSunday
  return date.getUTCDate() < lastSunday
}

function danishToUtc(date: Date): Date {
  const offset = isDanishSummerTime(date) ? 2 : 1
  return new Date(date.getTime() - offset * 60 * 60 * 1000)
}

// ─── syncBoldFixtures ───────────────────────────────────────────────────────

/**
 * Henter fixtures fra Bold API via phase_ids og upsert direkte til
 * rounds + matches tabellerne.
 */
export async function syncBoldFixtures(
  seasonId: number,
  boldPhaseId: number,
  options?: { dryRun?: boolean }
): Promise<{
  synced: number
  rounds_created: number
  matches_created: number
  matches_updated: number
  errors: string[]
  preview?: SyncBoldFixturesPreview
  raw_bold_response?: BoldMatchItem[]
}> {
  const dryRun = options?.dryRun ?? false
  const errors: string[] = []
  const stats = { synced: 0, rounds_created: 0, matches_created: 0, matches_updated: 0 }

  // ─── 1. Fetch all matches from Bold API (paginated) ───────────────────────

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
    if (page > 20) break
    page++
  }

  // Deduplicate on Bold match ID
  const seen = new Set<number>()
  const matches = allMatches.filter((entry) => {
    const id = entry.match?.id
    if (id == null) return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  if (!matches.length) {
    return { ...stats, synced: 0, errors }
  }

  // ─── 2. Resolve teams (batch lookup + insert missing) ─────────────────────

  const teamCache = new Map<number, number>()
  await resolveAllTeams(matches, teamCache)

  // ─── 3. Parse matches and group by round ──────────────────────────────────

  type ParsedMatch = {
    round_name: string
    home_team_id: number
    away_team_id: number
    kickoff: string
    home_score: number | null
    away_score: number | null
    status: 'scheduled' | 'live' | 'halftime' | 'finished'
    bold_match_id: number
    result: string | null
    home_team_name: string
    away_team_name: string
  }

  const parsedMatches: ParsedMatch[] = []
  const roundGroups = new Map<string, ParsedMatch[]>()

  for (const m of matches) {
    const mt = m.match

    // Resolve team IDs
    const homeTeamId = teamCache.get(mt.home_team?.id) ?? await resolveTeamId(mt.home_team, teamCache)
    const awayTeamId = teamCache.get(mt.away_team?.id) ?? await resolveTeamId(mt.away_team, teamCache)
    if (!homeTeamId || !awayTeamId) {
      errors.push(`Hold ikke fundet: ${mt.home_team?.name} (${mt.home_team?.id}) vs ${mt.away_team?.name} (${mt.away_team?.id})`)
      continue
    }

    // Parse date — Bold API returns Danish local time (CET/CEST), convert to UTC
    if (stats.synced < 3) console.log('[Bold raw date]', mt.date)
    const kickoff = (() => {
      const ma = mt.date.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/)
      if (ma) {
        const danishAsUtc = new Date(`${ma[1]}T${ma[2].padStart(2, '0')}:${ma[3]}:00Z`)
        return danishToUtc(danishAsUtc).toISOString()
      }
      return danishToUtc(new Date(`${mt.date.slice(0, 10)}T15:00:00Z`)).toISOString()
    })()

    // Status
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

    // Don't set future matches to finished/live/halftime
    if (new Date(kickoff) > new Date()) {
      status = 'scheduled'
    }

    const round_name = mt.round || 'Ukendt runde'

    // Result (1, X, 2)
    let result: string | null = null
    if (status === 'finished' && hasScores) {
      result = homeScore! > awayScore! ? '1' : homeScore! === awayScore! ? 'X' : '2'
    }

    const parsed: ParsedMatch = {
      round_name,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      kickoff,
      home_score: hasScores ? homeScore : null,
      away_score: hasScores ? awayScore : null,
      status,
      bold_match_id: mt.id,
      result,
      home_team_name: mt.home_team?.name ?? '',
      away_team_name: mt.away_team?.name ?? '',
    }

    parsedMatches.push(parsed)
    if (!roundGroups.has(round_name)) roundGroups.set(round_name, [])
    roundGroups.get(round_name)!.push(parsed)
  }

  if (!parsedMatches.length) {
    return { ...stats, errors }
  }

  // Preview (for dry-run)
  const preview: SyncBoldFixturesPreview = parsedMatches.map((p) => ({
    season_id: seasonId,
    round_name: p.round_name,
    home_team: p.home_team_name,
    away_team: p.away_team_name,
    kickoff: p.kickoff,
    home_score: p.home_score,
    away_score: p.away_score,
    status: p.status,
    bold_match_id: p.bold_match_id,
  }))

  if (dryRun) {
    return {
      ...stats,
      synced: parsedMatches.length,
      errors,
      preview,
      raw_bold_response: allMatches,
    }
  }

  // ─── 4. Upsert rounds ────────────────────────────────────────────────────

  // Fetch existing rounds for this season
  const { data: existingRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name')
    .eq('season_id', seasonId)

  const roundMap = new Map<string, number>()
  for (const r of existingRounds ?? []) {
    roundMap.set(r.name, r.id)
  }

  // Find new round names
  const newRoundNames = [...roundGroups.keys()].filter((name) => !roundMap.has(name))
  if (newRoundNames.length) {
    const roundRows = newRoundNames.map((name) => {
      const roundMatches = roundGroups.get(name)!
      const firstKickoff = roundMatches.reduce<string | null>((min, m) => {
        return !min || m.kickoff < min ? m.kickoff : min
      }, null)
      return {
        season_id: seasonId,
        name,
        status: roundMatches.every((m) => m.status === 'finished') ? 'finished' : 'upcoming',
        betting_closes_at: firstKickoff,
      }
    })

    const { data: inserted, error: roundError } = await supabaseAdmin
      .from('rounds')
      .upsert(roundRows, { onConflict: 'season_id,name' })
      .select('id, name')

    if (roundError) {
      errors.push(`Rounds upsert fejl: ${roundError.message}`)
    } else {
      for (const r of inserted ?? []) {
        roundMap.set(r.name, r.id)
        stats.rounds_created++
      }
    }
  }

  // ─── 5. Upsert matches ───────────────────────────────────────────────────

  // Fetch existing bold_match_ids so we know what's created vs updated
  const { data: existingMatches } = await supabaseAdmin
    .from('matches')
    .select('bold_match_id')
    .eq('season_id', seasonId)
    .not('bold_match_id', 'is', null)

  const existingBoldIds = new Set(
    (existingMatches ?? []).map((m) => m.bold_match_id as number)
  )

  const nowIso = new Date().toISOString()

  // Split into new matches (INSERT with bet_open=true) and existing (UPDATE without bet_open)
  const newMatchRows = parsedMatches
    .filter((p) => !existingBoldIds.has(p.bold_match_id))
    .map((p) => ({
      season_id: seasonId,
      round_id: roundMap.get(p.round_name) ?? null,
      round_name: p.round_name,
      home_team_id: p.home_team_id,
      away_team_id: p.away_team_id,
      kickoff: p.kickoff,
      home_score: p.home_score,
      away_score: p.away_score,
      status: p.status,
      bold_match_id: p.bold_match_id,
      result: p.result,
      bet_open: true,
      bet_lock_at: new Date(new Date(p.kickoff).getTime() - 30 * 60 * 1000).toISOString(),
      updated_at: nowIso,
    }))

  const existingMatchRows = parsedMatches
    .filter((p) => existingBoldIds.has(p.bold_match_id))
    .map((p) => ({
      season_id: seasonId,
      round_id: roundMap.get(p.round_name) ?? null,
      round_name: p.round_name,
      home_team_id: p.home_team_id,
      away_team_id: p.away_team_id,
      kickoff: p.kickoff,
      home_score: p.home_score,
      away_score: p.away_score,
      status: p.status,
      bold_match_id: p.bold_match_id,
      result: p.result,
      bet_lock_at: new Date(new Date(p.kickoff).getTime() - 30 * 60 * 1000).toISOString(),
      updated_at: nowIso,
    }))

  // INSERT new matches (with bet_open = true)
  for (let i = 0; i < newMatchRows.length; i += 500) {
    const chunk = newMatchRows.slice(i, i + 500)
    const { error } = await supabaseAdmin
      .from('matches')
      .insert(chunk)

    if (error) {
      errors.push(`Matches insert fejl (chunk ${i}–${i + chunk.length}): ${error.message}`)
    } else {
      stats.matches_created += chunk.length
    }
  }

  // UPDATE existing matches (preserve bet_open — don't overwrite locked matches)
  for (let i = 0; i < existingMatchRows.length; i += 500) {
    const chunk = existingMatchRows.slice(i, i + 500)
    const { error } = await supabaseAdmin
      .from('matches')
      .upsert(chunk, { onConflict: 'bold_match_id' })

    if (error) {
      errors.push(`Matches update fejl (chunk ${i}–${i + chunk.length}): ${error.message}`)
    } else {
      stats.matches_updated += chunk.length
    }
  }

  stats.synced = parsedMatches.length

  console.log(
    `[syncBoldFixtures] sæson ${seasonId}: ${stats.synced} kampe, ` +
    `${stats.rounds_created} runder oprettet, ${stats.matches_created} matches oprettet, ` +
    `${stats.matches_updated} opdateret (phase_id=${boldPhaseId})`
  )

  return { ...stats, errors }
}

// ─── syncSeasonViaBold ──────────────────────────────────────────────────────

/** Synkroniser en sæson via Bold API. Kræver bold_phase_id på seasons. */
export async function syncSeasonViaBold(seasonId: number): Promise<{
  synced: number
  rounds_created: number
  matches_created: number
  matches_updated: number
  errors: string[]
}> {
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('bold_phase_id')
    .eq('id', seasonId)
    .single()

  if (!season?.bold_phase_id) {
    return { synced: 0, rounds_created: 0, matches_created: 0, matches_updated: 0, errors: [`Sæson ${seasonId} mangler bold_phase_id`] }
  }
  return syncBoldFixtures(seasonId, season.bold_phase_id)
}

// ─── buildLeagueRounds (compat wrapper) ─────────────────────────────────────

export type BuildLeagueRoundsResult = Pick<SyncResult, 'rounds_created' | 'matches_created' | 'matches_updated'>
export type BuildGameRoundsResult = BuildLeagueRoundsResult

/**
 * Kompatibilitetsfunktion — kalder syncSeasonViaBold direkte.
 * league_matches bruges ikke længere.
 */
export async function buildLeagueRounds(seasonId: number): Promise<BuildLeagueRoundsResult> {
  const res = await syncSeasonViaBold(seasonId)
  return {
    rounds_created: res.rounds_created,
    matches_created: res.matches_created,
    matches_updated: res.matches_updated,
  }
}

/** @deprecated Brug buildLeagueRounds(seasonId) i stedet */
export const buildGameRounds = (_gameId: number, seasonId: number) => buildLeagueRounds(seasonId)

// ─── Daglig cron: synkroniser alle sæsoner ──────────────────────────────────

export async function runLeagueSync(): Promise<SyncResult[]> {
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

    try {
      if (!season.bold_phase_id) {
        results.push({
          season_id: season.id,
          synced: 0,
          rounds_created: 0,
          matches_created: 0,
          matches_updated: 0,
          errors: [`Ingen datakilde konfigureret for ${name} (bold_phase_id mangler)`],
        })
        continue
      }

      const res = await syncBoldFixtures(season.id, season.bold_phase_id)

      console.log(
        `[sync-fixtures] ${name} (id=${season.id}, bold_phase_id=${season.bold_phase_id}): ` +
          `${res.synced} kampe synket, ${res.matches_created} matches oprettet, ${res.matches_updated} opdateret` +
          (res.errors.length ? ` — ${res.errors.length} fejl` : '')
      )

      results.push({
        season_id: season.id,
        synced: res.synced,
        rounds_created: res.rounds_created,
        matches_created: res.matches_created,
        matches_updated: res.matches_updated,
        errors: res.errors,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[sync-fixtures] ${name} (id=${season.id}): ${msg}`)
      results.push({
        season_id: season.id,
        synced: 0,
        rounds_created: 0,
        matches_created: 0,
        matches_updated: 0,
        errors: [msg],
      })
    }
  }

  return results
}

// ─── Kort-interval cron: kun aktive sæsoner ─────────────────────────────────

export async function runSyncResultsOnly(): Promise<SyncResult[]> {
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

    results.push({
      season_id: season.id,
      synced: res.synced,
      rounds_created: res.rounds_created,
      matches_created: res.matches_created,
      matches_updated: res.matches_updated,
      errors: res.errors,
    })
  }

  return results
}
