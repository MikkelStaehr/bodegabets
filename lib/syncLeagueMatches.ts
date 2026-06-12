/**
 * syncLeagueMatches.ts
 *
 * syncBoldFixtures(seasonId, boldPhaseIds)
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

// Dansk dato-suffix til runde-navne ved date-split (multi-phase turneringer).
// Bold leverer dato i dansk lokaltid, så vi grupperer på den viste kalenderdag.
const DANISH_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
function danishDateLabel(boldDate: string): string {
  const m = boldDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const day = parseInt(m[3], 10)
  const month = parseInt(m[2], 10)
  return `${day}. ${DANISH_MONTHS[month - 1] ?? ''}`.trim()
}

// Matchdag-label til runde-gruppering. En "spillerunde" defineres som tidsrummet
// fra kl. 12:00 (dansk) til 11:59 dagen efter — så alle kampe i en football-aften
// OG dens natkampe (der spiller forbi midnat for turneringer i fx USA) havner i
// SAMME runde. Kampe mellem 00:00–11:59 dansk hører derfor til DAGEN FØR.
// Grænsen kl. 12:00 er sikker: ingen turnering har kampe i tidsrummet ~06:00–18:00
// dansk (USA sover), så den splitter aldrig en kampdag — og en runde starter
// aldrig kl. 06:00 om morgenen (hvor folk ikke kan nå at spille). For europæiske
// turneringer (EM) er der ingen natkampe → ingen effekt.
function matchDayLabel(boldDate: string): string {
  const m = boldDate.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):/)
  if (!m) return danishDateLabel(boldDate)
  const hour = parseInt(m[4], 10)
  let year = parseInt(m[1], 10)
  let month = parseInt(m[2], 10)
  let day = parseInt(m[3], 10)
  if (hour < 12) {
    // Gå én kalenderdag tilbage (UTC-baseret aritmetik undgår lokal-TZ-skred)
    const dt = new Date(Date.UTC(year, month - 1, day))
    dt.setUTCDate(dt.getUTCDate() - 1)
    year = dt.getUTCFullYear()
    month = dt.getUTCMonth() + 1
    day = dt.getUTCDate()
  }
  return `${day}. ${DANISH_MONTHS[month - 1] ?? ''}`.trim()
}

// Normalisér Bolds rå round-felt ("1. runde", "Final. runde", "kvartfinale"
// osv.) til pæne danske stage-navne + en rang (til at vælge dominerende stage
// på blandede dage). Rækkefølgen er vigtig: knockout tjekkes før "final" og
// gruppe-mønstret er præcist så det ikke fanger "1/16-finale".
const STAGE_DEFS: ReadonlyArray<{ test: RegExp; label: string; rank: number }> = [
  { test: /^[1-3]\.\s*runde/i, label: 'Gruppespil', rank: 0 },
  { test: /1\s*\/\s*16/i, label: '1/16-finale', rank: 1 },
  { test: /ottendedels/i, label: 'Ottendedelsfinale', rank: 2 },
  { test: /kvart/i, label: 'Kvartfinale', rank: 3 },
  { test: /semi/i, label: 'Semifinale', rank: 4 },
  { test: /bronze/i, label: 'Bronzekamp', rank: 5 },
  { test: /final/i, label: 'Finale', rank: 6 },
]
function stageOf(boldRound: string): { label: string; rank: number } {
  for (const s of STAGE_DEFS) if (s.test.test(boldRound)) return { label: s.label, rank: s.rank }
  return { label: boldRound, rank: 0 }
}
// Vælg dominerende stage for en dags kampe: flest kampe vinder, ties brydes
// af tidligste stage (laveste rang) — fx på overgangsdage med gruppe + knockout.
function dominantStageLabel(boldRounds: string[]): string {
  const tally = new Map<string, { count: number; rank: number }>()
  for (const r of boldRounds) {
    const s = stageOf(r)
    const e = tally.get(s.label) ?? { count: 0, rank: s.rank }
    e.count++
    tally.set(s.label, e)
  }
  let best: { label: string; count: number; rank: number } | null = null
  for (const [label, { count, rank }] of tally) {
    if (!best || count > best.count || (count === best.count && rank < best.rank)) {
      best = { label, count, rank }
    }
  }
  return best?.label ?? 'VM'
}

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
 *
 * boldPhaseIds accepterer en string der bruges uændret i Bold's ?phase_ids=
 * parameter — enten et enkelt id ("24470") eller komma-separeret for
 * multi-phase turneringer ("22620,22621,22622").
 */
export async function syncBoldFixtures(
  seasonId: number,
  boldPhaseIds: string,
  options?: { dryRun?: boolean; splitRoundsByDate?: boolean }
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
  const splitRoundsByDate = options?.splitRoundsByDate ?? false
  const errors: string[] = []
  const stats = { synced: 0, rounds_created: 0, matches_created: 0, matches_updated: 0 }

  // ─── 1. Fetch all matches from Bold API (paginated) ───────────────────────

  const allMatches: BoldMatchItem[] = []
  const limit = 50
  let page = 1
  let totalPageCount = 1

  while (true) {
    const offset = (page - 1) * limit
    const url = `${BOLD_MATCHES_API}?phase_ids=${boldPhaseIds}&page=${page}&limit=${limit}&offset=${offset}`
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
    bold_round: string
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

    // Multi-phase turneringer (VM/EM): gruppér KUN på kalenderdag, så vi aldrig
    // får to runder samme dag (Bolds runde-felt overlapper — fx gruppe-spilledag
    // og første knockout-kamp samme dato). Det pæne stage-navn udledes post-loop
    // fra dagens kampe. For normale ligaer bruges Bolds round-felt direkte.
    const baseRound = mt.round || 'Ukendt runde'
    const round_name = splitRoundsByDate
      ? matchDayLabel(mt.date)
      : baseRound

    // Result (1, X, 2)
    let result: string | null = null
    if (status === 'finished' && hasScores) {
      result = homeScore! > awayScore! ? '1' : homeScore! === awayScore! ? 'X' : '2'
    }

    const parsed: ParsedMatch = {
      round_name,
      bold_round: baseRound,
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

  // Split-mode: rundene er pt. grupperet på ren dato ("18. jun"). Giv hver dag
  // et pænt stage-navn udledt fra dagens kampe ("Gruppespil · 18. jun",
  // "Kvartfinale · 9. jul"). Stadig præcis én runde pr. dag.
  if (splitRoundsByDate) {
    const renamed = new Map<string, ParsedMatch[]>()
    for (const [dateLabel, group] of roundGroups) {
      const name = `${dominantStageLabel(group.map((m) => m.bold_round))} · ${dateLabel}`
      for (const p of group) p.round_name = name
      renamed.set(name, group)
    }
    roundGroups.clear()
    for (const [name, group] of renamed) roundGroups.set(name, group)
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

  // ─── 6. Ryd forældreløse runder (kun multi-phase) ─────────────────────────
  // Når runde-navne ændrer sig (fx date-split slået til), flytter kampene til
  // nye runder og efterlader de gamle tomme. Slet runder for denne sæson der
  // ikke længere har kampe. Scoped til splitRoundsByDate så normale ligaer
  // (hvor navne er stabile) aldrig rammes.
  if (splitRoundsByDate) {
    const { data: seasonRounds } = await supabaseAdmin
      .from('rounds')
      .select('id')
      .eq('season_id', seasonId)
    const roundIds = (seasonRounds ?? []).map((r) => r.id as number)
    if (roundIds.length) {
      const { data: roundsWithMatches } = await supabaseAdmin
        .from('matches')
        .select('round_id')
        .eq('season_id', seasonId)
        .not('round_id', 'is', null)
      const usedRoundIds = new Set((roundsWithMatches ?? []).map((m) => m.round_id as number))
      const orphanIds = roundIds.filter((id) => !usedRoundIds.has(id))
      if (orphanIds.length) {
        const { error: delErr } = await supabaseAdmin
          .from('rounds')
          .delete()
          .in('id', orphanIds)
        if (delErr) {
          errors.push(`Kunne ikke rydde forældreløse runder: ${delErr.message}`)
        } else {
          console.log(`[syncBoldFixtures] Ryddede ${orphanIds.length} forældreløse runder for sæson ${seasonId}`)
        }
      }
    }
  }

  stats.synced = parsedMatches.length

  return { ...stats, errors }
}

// ─── syncSeasonViaBold ──────────────────────────────────────────────────────

/**
 * Synkroniser en sæson via Bold API. Kræver bold_phase_ids — text-format der
 * kan rumme én id (Premier League: "24470") eller flere komma-separerede
 * (VM/EM med gruppespil: "22620,22621,22622"). Multi-phase sæsoner splittes
 * pr. dato i runder for overskuelige betting-kuponer.
 */
export async function syncSeasonViaBold(seasonId: number): Promise<{
  synced: number
  rounds_created: number
  matches_created: number
  matches_updated: number
  errors: string[]
}> {
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('bold_phase_ids')
    .eq('id', seasonId)
    .single() as { data: { bold_phase_ids: string | null } | null }

  const phaseIds = season?.bold_phase_ids
  if (!phaseIds) {
    return { synced: 0, rounds_created: 0, matches_created: 0, matches_updated: 0, errors: [`Sæson ${seasonId} mangler bold_phase_ids`] }
  }
  const isMultiPhase = phaseIds.includes(',')
  const result = await syncBoldFixtures(seasonId, phaseIds, { splitRoundsByDate: isMultiPhase })

  // VM-specifik post-sync: omstrukturér til ~10-kamps gruppespils-runder +
  // samlede knockout-faser. Bold-sync giver os én runde pr. kampdag (35),
  // som vi grupperer ned til 14 til betting-overblik. Idempotent.
  if (seasonId === 25) {
    try {
      const { restructureVmRounds } = await import('@/lib/restructureVmRounds')
      await restructureVmRounds(seasonId)
    } catch (err) {
      result.errors.push(`VM-restructure failed: ${String(err)}`)
    }
  }

  return result
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

// ─── Daglig cron: synkroniser alle sæsoner ──────────────────────────────────

export async function runLeagueSync(): Promise<SyncResult[]> {
  // Hent sæsoner med bold_phase_ids udfyldt.
  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('id, bold_phase_ids, tournaments:tournament_id(name)')
    .not('bold_phase_ids', 'is', null) as { data: Array<{ id: number; bold_phase_ids: string | null; tournaments: unknown }> | null }

  if (!seasons?.length) {
    return []
  }

  const results: SyncResult[] = []

  for (const season of seasons) {
    const tournaments = season.tournaments as unknown as { name: string } | null
    const name = tournaments?.name ?? `Sæson ${season.id}`

    try {
      const phaseIds = season.bold_phase_ids
      if (!phaseIds) {
        results.push({
          season_id: season.id,
          synced: 0,
          rounds_created: 0,
          matches_created: 0,
          matches_updated: 0,
          errors: [`Ingen datakilde konfigureret for ${name} (bold_phase_ids mangler)`],
        })
        continue
      }

      const isMultiPhase = phaseIds.includes(',')
      const res = await syncBoldFixtures(season.id, phaseIds, { splitRoundsByDate: isMultiPhase })

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
    .select('id, bold_phase_ids, tournaments:tournament_id(name)')
    .in('id', seasonIds)
    .not('bold_phase_ids', 'is', null) as { data: Array<{ id: number; bold_phase_ids: string | null; tournaments: unknown }> | null }

  const results: SyncResult[] = []

  for (const season of (seasons ?? [])) {
    const phaseIds = season.bold_phase_ids
    if (!phaseIds) continue

    const isMultiPhase = phaseIds.includes(',')
    const res = await syncBoldFixtures(season.id, phaseIds, { splitRoundsByDate: isMultiPhase })

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
