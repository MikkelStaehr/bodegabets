/**
 * syncLeagueMatches.ts
 *
 * syncResults(leagueId, boldSlug)
 *   Henter seneste resultater fra Bold.dk og opdaterer scores i league_matches.
 *   Køres dagligt via cron.
 *
 * buildGameRounds(gameId, leagueId)
 *   Opretter/opdaterer runder og matches i ét spilrum fra league_matches.
 *   Forudsætter at league_matches er populeret (via admin-sync).
 *
 * runLeagueSync()
 *   Daglig cron: opdaterer resultater + bygger runder for alle aktive ligaer.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getResults, danishTimeToUtc } from '@/lib/boldApi'
import { syncLeagueFixtures } from '@/lib/fixtureDownload'
import { findBestTeamMatch } from '@/lib/teamNameNormalizer'

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

// ─── Typer ────────────────────────────────────────────────────────────────────

export type SyncResult = {
  league_id:       number
  synced:          number
  rounds_created:  number
  matches_created: number
  matches_updated: number
  errors:          string[]
}

// ─── 1. Resultater fra Bold.dk API (live, pauseresultater, slutresultater) ─────

export async function syncResults(
  leagueId: number,
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
      .eq('league_id', leagueId)
      .gte('kickoff_at', `${dateStr}T00:00:00Z`)
      .lte('kickoff_at', `${dateStr}T23:59:59Z`)

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

  console.log(`[syncResults] ${synced} resultater opdateret for liga ${leagueId}`)
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
 * Bruges for ligaer med bold_slug men uden fixturedownload_slug (fx Superligaen).
 */
export async function syncBoldFixtures(
  leagueId: number,
  boldPhaseId: number
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = []

  const allMatches: BoldMatchItem[] = []
  let page = 1

  while (true) {
    const url = `${BOLD_MATCHES_API}?phase_ids=${boldPhaseId}&page=${page}`
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
    allMatches.push(...(data.matches ?? []))
    if (page >= (data.total_page_count ?? 1)) break
    if (page > 20) break // Safety: ingen liga har mere end 1000 kampe
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
    const kickoff_at = danishTimeToUtc(date, time)

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

    return {
      league_id: leagueId,
      round_name,
      home_team: mt.home_team?.name ?? '',
      away_team: mt.away_team?.name ?? '',
      kickoff_at,
      home_score: hasScores ? homeScore : null,
      away_score: hasScores ? awayScore : null,
      status,
      bold_match_id: mt.id,
      updated_at: new Date().toISOString(),
    }
  }).filter((r) => r.home_team && r.away_team)

  // Deduplikér på konfliktnøgle — undgå "cannot affect row a second time" ved upsert
  const conflictKey = (r: { league_id: number; home_team: string; away_team: string; kickoff_at: string }) =>
    `${r.league_id}|${r.home_team}|${r.away_team}|${r.kickoff_at}`
  const rowsByKey = new Map<string, (typeof rows)[0]>()
  for (const r of rows) {
    rowsByKey.set(conflictKey(r), r) // sidste vinder — én per konfliktnøgle
  }
  const uniqueRows = [...rowsByKey.values()]

  const { error } = await supabaseAdmin
    .from('league_matches')
    .upsert(uniqueRows, { onConflict: 'league_id,home_team,away_team,kickoff_at' })

  if (error) {
    return { synced: 0, errors: [error.message] }
  }

  console.log(`[syncBoldFixtures] liga ${leagueId}: ${uniqueRows.length} kampe fra Bold API (phase_id=${boldPhaseId})`)
  return { synced: uniqueRows.length, errors }
}

// ─── 2. Opbyg runder + matches i ét spilrum fra league_matches ───────────────
// Optimeret: maks 6 DB-kald uanset antal kampe/runder (batch insert/update)

export type BuildGameRoundsResult = Pick<SyncResult, 'rounds_created' | 'matches_created' | 'matches_updated'> & {
  debug?: {
    rounds_matched: number
    rounds_skipped: number
    to_insert: number
    round_names_sample?: string[]
    db_round_names_sample?: string[]
  }
}

export async function buildGameRounds(
  gameId: number,
  leagueId: number
): Promise<BuildGameRoundsResult> {
  const stats = { rounds_created: 0, matches_created: 0, matches_updated: 0 }

  type LM = {
    id: number; round_name: string; home_team: string; away_team: string
    kickoff_at: string; home_score: number | null; away_score: number | null; status: string
  }
  type ExRound = { id: number; name: string }
  type ExMatch = { id: number; home_team: string; away_team: string; status: string; round_id: number; league_match_id?: number | null }

  // 1. Hent alt data parallelt (3 queries)
  const [lmRes, roundRes] = await Promise.all([
    supabaseAdmin
      .from('league_matches')
      .select('id, round_name, home_team, away_team, kickoff_at, home_score, away_score, status')
      .eq('league_id', leagueId)
      .order('kickoff_at', { ascending: true }),
    supabaseAdmin
      .from('rounds')
      .select('id, name')
      .eq('game_id', gameId),
  ])

  const leagueMatches  = (lmRes.data ?? []) as LM[]
  if (!leagueMatches.length) {
    console.log(`[buildGameRounds] game ${gameId}: ingen league_matches for liga ${leagueId}`)
    return stats
  }

  const existingRounds = (roundRes.data ?? []) as ExRound[]

  // round_id.game_id filter virker ikke direkte — hent matches via runde-IDs
  const existingRoundIds = existingRounds.map((r) => r.id)
  let existingMatches: ExMatch[] = []
  if (existingRoundIds.length) {
    const { data } = await supabaseAdmin
      .from('matches')
      .select('id, home_team, away_team, status, round_id, league_match_id')
      .in('round_id', existingRoundIds)
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
  const matchByPair     = new Map<string, ExMatch>(existingMatches.map((m) => [`${m.round_id}|${m.home_team}|${m.away_team}`, m]))

  // 3. Gruppér kampe per runde
  const groups = new Map<string, LM[]>()
  for (const m of leagueMatches) {
    if (!groups.has(m.round_name)) groups.set(m.round_name, [])
    groups.get(m.round_name)!.push(m)
  }

  // 4. Batch-insert nye runder (1 query)
  // betting_closes_at og betting_opens_at = NULL — brugeren vælger deadline ved oprettelse af spilrum
  const newRoundNames = [...groups.keys()].filter((name) => !getRoundId(name))
  if (newRoundNames.length) {
    const roundRows = newRoundNames.map((name) => {
      const matches = groups.get(name)!
      const firstKickoff = matches.reduce<string | null>((min, m) => {
        if (!m.kickoff_at) return min
        return !min || m.kickoff_at < min ? m.kickoff_at : min
      }, null)
      return {
        game_id:           gameId,
        league_id:         leagueId,
        name,
        stage:             'Grundspil',
        status:            matches.every((m) => m.status === 'finished') ? 'finished' : 'upcoming',
        betting_closes_at: firstKickoff,
        betting_opens_at:  null,
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
    // Reset betting_balance til 1000 for alle game_members når nye runder oprettes (start af ny runde)
    if ((inserted ?? []).length > 0) {
      await supabaseAdmin
        .from('game_members')
        .update({ betting_balance: 1000 })
        .eq('game_id', gameId)
    }
  }

  // 5. Beregn hvilke matches der skal indsættes vs opdateres
  const toInsert: object[] = []
  const toUpdate: {
    id: number
    home_score: number | null
    away_score: number | null
    status: string
    league_match_id: number
  }[] = []

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
      const existing = matchByLmId.get(lm.id) ?? matchByPair.get(`${roundId}|${lm.home_team}|${lm.away_team}`)

      if (existing) {
        const hasScores = lm.home_score != null && lm.away_score != null
        if (existing.status !== 'finished' && hasScores) {
          const newStatus = lm.status === 'finished' ? 'finished' : lm.status === 'halftime' ? 'halftime' : 'live'
          toUpdate.push({
            id: existing.id,
            home_score: lm.home_score,
            away_score: lm.away_score,
            status: newStatus,
            league_match_id: lm.id,
          })
        }
        continue
      }

      const matchStatus =
        lm.status === 'finished' ? 'finished' : lm.status === 'halftime' ? 'halftime' : lm.status === 'live' ? 'live' : 'scheduled'
      toInsert.push({
        round_id:        roundId,
        league_match_id: lm.id,
        home_team:       lm.home_team,
        away_team:       lm.away_team,
        kickoff_at:      lm.kickoff_at,
        home_score:      lm.home_score,
        away_score:      lm.away_score,
        status:          matchStatus,
      })
    }
  }

  // 6. Batch-insert nye matches (1 query per chunk)
  if (toInsert.length) {
    console.log(`[buildGameRounds] game ${gameId}: indsætter ${toInsert.length} matches`)
    for (let i = 0; i < toInsert.length; i += 500) {
      const { error } = await supabaseAdmin.from('matches').insert(toInsert.slice(i, i + 500))
      if (error) {
        console.error(`[buildGameRounds] match insert fejlede (chunk ${i}–${i + 500}) for game ${gameId}:`, error.message)
      } else {
        stats.matches_created += toInsert.slice(i, i + 500).length
      }
    }
  }

  // 7. Opdater kampe med scores (live, halvleg, færdig)
  for (const u of toUpdate) {
    await supabaseAdmin
      .from('matches')
      .update({
        home_score: u.home_score,
        away_score: u.away_score,
        status: u.status,
        league_match_id: u.league_match_id,
      })
      .eq('id', u.id)
    stats.matches_updated++
  }

  const result: BuildGameRoundsResult = { ...stats }
  if (stats.matches_created === 0 && stats.matches_updated === 0) {
    const dbRoundSample = existingRounds.slice(0, 5).map((r) => `"${r.name}"`)
    result.debug = {
      rounds_matched: roundsMatched,
      rounds_skipped: roundsSkipped,
      to_insert: toInsert.length,
      round_names_sample: roundNamesSample.length ? roundNamesSample : undefined,
      db_round_names_sample: dbRoundSample,
    }
  }
  return result
}

// ─── 2b. Template-game for ligaer uden spilrum (live-scores) ─────────────────

/** Opretter et template-game for en liga hvis ingen games findes. Returnerer game_id eller null. */
async function ensureLeagueTemplateGame(leagueId: number, leagueName: string): Promise<number | null> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (!profile?.id) {
    console.warn(`[sync-fixtures] Ingen profil fundet — kan ikke oprette template-game for ${leagueName}`)
    return null
  }

  const inviteCode = `SYNC${leagueId.toString().padStart(4, '0')}`
  const { data: game, error } = await supabaseAdmin
    .from('games')
    .insert({
      name:           `[Sync] ${leagueName}`,
      description:    'Automatisk oprettet for fixture-sync. Bruges ikke af brugere.',
      host_id:        profile.id,
      invite_code:    inviteCode,
      league_id:      leagueId,
      status:         'active',
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[sync-fixtures] Kunne ikke oprette template-game for ${leagueName}:`, error.message)
    return null
  }

  await supabaseAdmin
    .from('game_members')
    .insert({ game_id: game.id, user_id: profile.id, points: 0 })

  console.log(`[sync-fixtures] Oprettet template-game id=${game.id} for ${leagueName}`)
  return game.id
}

// ─── 3. Daglig cron: opdater resultater + byg runder ─────────────────────────

export async function runLeagueSync(): Promise<SyncResult[]> {
  // Hent ALLE ligaer med bold_phase_id og is_active (ikke kun dem fra aktive spilrum)
  const { data: leagues } = await supabaseAdmin
    .from('leagues')
    .select('id, name, bold_slug, fixturedownload_slug, bold_phase_id')
    .eq('is_active', true)
    .not('bold_phase_id', 'is', null)

  if (!leagues?.length) {
    console.log('[sync-fixtures] Ingen ligaer med bold_phase_id og is_active=true')
    return []
  }

  const results: SyncResult[] = []

  type LeagueRow = {
    id: number
    name: string
    bold_slug: string | null
    fixturedownload_slug: string | null
    bold_phase_id: number | null
  }

  for (const league of leagues as LeagueRow[]) {
    let synced = 0
    const errors: string[] = []

    try {
      if (league.fixturedownload_slug) {
        // Primær kilde: fixturedownload.com — opdaterer scores + nye kampe
        const res = await syncLeagueFixtures(league.id)
        synced = res.synced
        errors.push(...res.errors)
      } else if (league.bold_slug && league.bold_phase_id) {
        // Fallback: Bold API via phase_ids — bruges til Superligaen og ligaer uden fixturedownload
        const res = await syncBoldFixtures(league.id, league.bold_phase_id)
        synced = res.synced
        errors.push(...res.errors)
      } else if (league.bold_slug && !league.bold_phase_id) {
        errors.push(`${league.name}: bold_slug findes men bold_phase_id mangler — sæt phase_id i admin`)
      } else {
        errors.push(`Ingen datakilde konfigureret for ${league.name} (fixturedownload_slug eller bold_slug mangler)`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)
      console.error(`[sync-fixtures] ${league.name} (id=${league.id}): ${msg}`)
      results.push({
        league_id: league.id,
        synced: 0,
        rounds_created: 0,
        matches_created: 0,
        matches_updated: 0,
        errors,
      })
      continue
    }

    // Kør buildGameRounds for ALLE games (inkl. template) — ikke kun aktive
    const { data: gamesForLeague } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('league_id', league.id)

    let gamesToBuild = (gamesForLeague ?? []) as { id: number }[]

    // Hvis ingen games findes: opret template-game så rounds/matches kan oprettes (live-scores)
    if (gamesToBuild.length === 0) {
      const templateGameId = await ensureLeagueTemplateGame(league.id, league.name)
      if (templateGameId) gamesToBuild = [{ id: templateGameId }]
    }

    let rounds_created = 0, matches_created = 0, matches_updated = 0
    for (const g of gamesToBuild) {
      const s = await buildGameRounds(g.id, league.id)
      rounds_created += s.rounds_created
      matches_created += s.matches_created
      matches_updated += s.matches_updated
    }

    console.log(
      `[sync-fixtures] ${league.name} (id=${league.id}, bold_phase_id=${league.bold_phase_id}): ` +
        `${synced} kampe synket, ${matches_created} matches oprettet, ${matches_updated} opdateret` +
        (errors.length ? ` — ${errors.length} fejl` : '')
    )

    results.push({ league_id: league.id, synced, rounds_created, matches_created, matches_updated, errors })
  }

  return results
}

// ─── 4. Kort-interval cron: kun Bold resultater (live/halftime/finished) ────────

export async function runSyncResultsOnly(): Promise<SyncResult[]> {
  const { data: activeGames } = await supabaseAdmin
    .from('games')
    .select('league_id')
    .eq('status', 'active')
    .not('league_id', 'is', null)

  if (!activeGames?.length) return []

  const leagueIds = [...new Set((activeGames as { league_id: number }[]).map((g) => g.league_id))]

  const { data: leagues } = await supabaseAdmin
    .from('leagues')
    .select('id, name, bold_slug')
    .in('id', leagueIds)
    .eq('is_active', true)
    .not('bold_slug', 'is', null)

  const results: SyncResult[] = []

  type LeagueRow = { id: number; name: string; bold_slug: string | null }

  for (const league of (leagues ?? []) as LeagueRow[]) {
    if (!league.bold_slug) continue

    const res = await syncResults(league.id, league.bold_slug)

    const { data: gamesForLeague } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('league_id', league.id)
      .eq('status', 'active')

    let rounds_created = 0, matches_created = 0, matches_updated = 0
    for (const g of (gamesForLeague ?? []) as { id: number }[]) {
      const s = await buildGameRounds(g.id, league.id)
      rounds_created  += s.rounds_created
      matches_created += s.matches_created
      matches_updated += s.matches_updated
    }

    results.push({
      league_id: league.id,
      synced: res.synced,
      rounds_created,
      matches_created,
      matches_updated,
      errors: res.errors,
    })
  }

  return results
}
