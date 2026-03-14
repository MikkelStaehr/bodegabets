/**
 * boldApi.ts
 * Bold.dk aggregator API — erstatter scraper.
 * Henter live scores, pauseresultater og slutresultater.
 * Kald max 1 gang per minut per dato.
 */

const BOLD_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

const BOLD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
  'Referer': 'https://www.bold.dk/',
  'Origin': 'https://www.bold.dk',
} as const

export type BoldMatchStatus =
  | 'notstarted'
  | 'inprogress'
  | 'finished'
  | 'cancelled'
  | 'postponed'

export type BoldMatch = {
  id: number
  match: {
    id: number
    date: string
    round: string
    tournament_id: number
    tournament_name: string
    home_team: {
      id: number
      name: string
      shortname: string
      slug: string
      score: number | null
    }
    away_team: {
      id: number
      name: string
      shortname: string
      slug: string
      score: number | null
    }
    paused: boolean
    status_type: BoldMatchStatus
    status_category: 'fixture' | 'live' | 'finished' | 'result'
    time: string | null
    estimatedTime: boolean
    url?: string
  }
  tournament: {
    id: number
    name: string
    shortname: string
    country: { name: string }
  }
}

export type BoldApiResponse = {
  matches: BoldMatch[]
}

export async function fetchBoldMatches(date: Date): Promise<BoldMatch[]> {
  const dateStr = date.toISOString().split('T')[0]
  const url = `${BOLD_API}?date=${dateStr}&limit=1001&page=1&has_pagination=0`

  const res = await fetch(url, {
    headers: BOLD_HEADERS,
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Bold API fejl: ${res.status}`)

  let text = ''
  let data: BoldApiResponse
  try {
    text = await res.text()
    data = JSON.parse(text) as BoldApiResponse
  } catch (err) {
    throw new Error(`Bold API JSON fejl: ${String(err)} — response: ${text?.slice(0, 500)}`)
  }
  return data.matches ?? []
}

export function classifyMatch(
  m: BoldMatch['match']
): 'notstarted' | 'live' | 'halftime' | 'finished' | 'cancelled' {
  if (m.status_type === 'cancelled' || m.status_type === 'postponed') return 'cancelled'
  if (m.status_type === 'finished') return 'finished'
  if (m.status_type === 'inprogress') {
    return m.paused ? 'halftime' : 'live'
  }
  return 'notstarted'
}

// bold_slug → tournament_name (matcher case-insensitive)
const BOLD_SLUG_TO_NAMES: Record<string, string[]> = {
  superligaen: ['3F Superliga', 'Superligaen'],
  'premier-league': ['Premier League'],
  premier_league: ['Premier League'],
  'la-liga': ['La Liga'],
  la_liga: ['La Liga'],
  'spanien-la-liga': ['La Liga'],
  bundesliga: ['Bundesliga'],
  'tyskland-1-bundesliga': ['Bundesliga'],
  serie_a: ['Serie A'],
  'italien-serie-a': ['Serie A'],
  ligue_1: ['Ligue 1'],
  'frankrig-ligue-1': ['Ligue 1'],
  'champions-league': ['Champions League', 'UEFA Champions League'],
  'europa-league': ['Europa League', 'UEFA Europa League'],
  'conference-league': ['Conference League', 'UEFA Conference League'],
}

function matchesTournament(boldSlug: string, tournamentName: string): boolean {
  const names = BOLD_SLUG_TO_NAMES[boldSlug]
  if (names) {
    return names.some((n) => tournamentName.toLowerCase().includes(n.toLowerCase()))
  }
  return tournamentName.toLowerCase().replace(/\s+/g, '-').includes(boldSlug.replace(/_/g, '-'))
}

/** Hent kampe for en liga i et datointerval (filtreret efter tournament) */
export async function fetchBoldMatchesForLeague(
  boldSlug: string,
  startDate: Date,
  endDate: Date
): Promise<BoldMatch[]> {
  const out: BoldMatch[] = []
  const seen = new Set<number>()

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const matches = await fetchBoldMatches(new Date(d))
    for (const m of matches) {
      const name = m.match.tournament_name ?? m.tournament?.name ?? ''
      if (!matchesTournament(boldSlug, name)) continue
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
    }
  }
  return out
}

// ─── Kompatibilitet med fixtureDownload / syncLeagueMatches ───────────────────

export type Fixture = {
  date: string
  kickoff_time: string
  round: string
  home_team: string
  away_team: string
  bold_match_url: string
}

export type Result = {
  date: string
  round: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  status: 'finished' | 'live' | 'halftime'
  bold_match_url: string
  bold_match_id: number
}

/** Konverterer dansk lokaltid til UTC ISO-string */
export function danishTimeToUtc(dateStr: string, timeStr: string): string {
  if (!dateStr) return new Date(0).toISOString()
  const month = parseInt(dateStr.slice(5, 7), 10)
  const offsetHours = month >= 4 && month <= 9 ? 2 : 1
  const [hh, mm] =
    timeStr && timeStr !== '00:00' ? timeStr.split(':').map(Number) : [12, 0]
  const utcHour = hh - offsetHours
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (utcHour < 0) {
    d.setUTCDate(d.getUTCDate() - 1)
    d.setUTCHours(utcHour + 24, mm, 0, 0)
  } else {
    d.setUTCHours(utcHour, mm, 0, 0)
  }
  return d.toISOString()
}

function parseBoldDate(dateStr: string): { date: string; time: string } {
  // "2025-03-04 19:00:00" eller "2025-03-04 00:00:00"
  const m = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/)
  if (m) {
    return { date: m[1], time: `${m[2].padStart(2, '0')}:${m[3]}` }
  }
  const d = dateStr.split('T')[0] ?? dateStr.slice(0, 10)
  return { date: d, time: '15:00' }
}

/** Hent kommende kampe (fixtures) fra Bold API */
export async function getFixtures(leagueSlug: string): Promise<Fixture[]> {
  const today = new Date()
  const end = new Date(today)
  end.setDate(end.getDate() + 90)
  const matches = await fetchBoldMatchesForLeague(leagueSlug, today, end)

  return matches
    .filter((m) => m.match.status_type === 'notstarted' || m.match.status_type === 'postponed')
    .map((m) => {
      const { date, time } = parseBoldDate(m.match.date)
      return {
        date,
        kickoff_time: time,
        round: m.match.round || '',
        home_team: m.match.home_team.name,
        away_team: m.match.away_team.name,
        bold_match_url: m.match.url ? `https://bold.dk${m.match.url}` : `https://bold.dk/fodbold/kamp/${m.match.home_team.slug}-vs-${m.match.away_team.slug}`,
        home_bold_team_id: m.match.home_team?.id ?? null,
        away_bold_team_id: m.match.away_team?.id ?? null,
      }
    })
}

/** Hent færdige kampe (resultater) inkl. live/pause fra Bold API */
export async function getResults(leagueSlug: string): Promise<Result[]> {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 60)
  const matches = await fetchBoldMatchesForLeague(leagueSlug, start, end)

  return matches
    .filter(
      (m) =>
        m.match.status_type === 'finished' ||
        m.match.status_type === 'inprogress' ||
        (m.match.status_type === 'notstarted' && m.match.home_team.score != null)
    )
    .filter((m) => m.match.home_team.score != null && m.match.away_team.score != null)
    .map((m) => {
      const { date } = parseBoldDate(m.match.date)
      const status =
        m.match.status_type === 'finished'
          ? ('finished' as const)
          : m.match.paused
            ? ('halftime' as const)
            : ('live' as const)
      return {
        date,
        round: m.match.round || '',
        home_team: m.match.home_team.name,
        away_team: m.match.away_team.name,
        home_score: m.match.home_team.score ?? 0,
        away_score: m.match.away_team.score ?? 0,
        status,
        bold_match_url: m.match.url ? `https://bold.dk${m.match.url}` : `https://bold.dk/fodbold/kamp/${m.match.home_team.slug}-vs-${m.match.away_team.slug}`,
        bold_match_id: m.match.id,
      }
    })
}
