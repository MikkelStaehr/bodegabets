import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

export type SyncMatchScoresPreview = Array<{
  league_match_id: number
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  status: string
  matches_status: string
}>

export async function syncMatchScores(options?: {
  dryRun?: boolean
  boldMatchId?: number
}): Promise<{ updated: number; errors: string[]; preview?: SyncMatchScoresPreview; raw_bold_response?: unknown }> {
  const { dryRun = false, boldMatchId } = options ?? {}
  const errors: string[] = []
  let updated = 0
  const preview: SyncMatchScoresPreview = []

  // 1. Find kampe der skal synkes:
  // - Fra matches: status live/scheduled/halftime (uanset tid – fanger sen-aften kampe)
  // - Eller league_matches: kickoff indenfor 18 timer, ikke finished (bredere tidsvindue)
  const now = new Date()
  const eighteenHoursAgo = new Date(now.getTime() - 18 * 60 * 60 * 1000)

  let activeMatches: Array<{ id: number; bold_match_id: number | null; league_id: number; home_team: string; away_team: string; status: string }> = []

  if (boldMatchId != null) {
    const { data, error } = await supabaseAdmin
      .from('league_matches')
      .select('id, bold_match_id, league_id, home_team, away_team, status')
      .eq('bold_match_id', boldMatchId)
    if (error) {
      errors.push(`Fetch fejl: ${error.message}`)
      return { updated, errors }
    }
    activeMatches = data ?? []
  } else {
    // Hent league_match_ids fra matches med status live/scheduled/halftime
    const { data: matchRows } = await supabaseAdmin
      .from('matches')
      .select('league_match_id')
      .in('status', ['live', 'scheduled', 'halftime'])
    const liveMatchIds = [...new Set((matchRows ?? []).map((r) => r.league_match_id).filter((id): id is number => id != null))]

    // Hent league_matches: enten fra live-match-ids ELLER kickoff indenfor 18 timer
    const byLiveMatch =
      liveMatchIds.length > 0
        ? await supabaseAdmin
            .from('league_matches')
            .select('id, bold_match_id, league_id, home_team, away_team, status')
            .in('id', liveMatchIds)
        : { data: [] as typeof activeMatches, error: null }
    const byTimeWindow = await supabaseAdmin
      .from('league_matches')
      .select('id, bold_match_id, league_id, home_team, away_team, status')
      .neq('status', 'finished')
      .lte('kickoff_at', now.toISOString())
      .gte('kickoff_at', eighteenHoursAgo.toISOString())

    const fetchError = byLiveMatch.error ?? byTimeWindow.error
    if (fetchError) {
      errors.push(`Fetch fejl: ${fetchError.message}`)
      return { updated, errors }
    }

    const seen = new Set<number>()
    for (const m of [...(byLiveMatch.data ?? []), ...(byTimeWindow.data ?? [])]) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        activeMatches.push(m)
      }
    }
  }

  if (!activeMatches?.length) {
    console.log('[syncMatchScores] Ingen aktive kampe lige nu')
    return { updated, errors }
  }

  console.log(`[syncMatchScores] ${activeMatches.length} aktive kampe at tjekke`)

  const boldMatchIds = activeMatches
    .map((m) => m.bold_match_id)
    .filter((id): id is number => id != null)

  if (!boldMatchIds.length) return { updated, errors }

  const boldMatchMap = new Map<number, { home_score: number; away_score: number; status: string }>()
  let rawBoldResponse: unknown = null

  try {
    const url = `${BOLD_MATCHES_API}?match_ids=${boldMatchIds.join(',')}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BodegaBets/1.0', 'Accept': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      errors.push(`Bold API fejl: ${res.status} ${res.statusText}`)
      return { updated, errors }
    }

    const data = (await res.json()) as { matches?: unknown[] }
    rawBoldResponse = data
    for (const m of (data.matches ?? []) as Array<{ match?: { id: number; status_type: string; paused?: boolean; home_team?: { score: number }; away_team?: { score: number } } }>) {
      const match = m.match
      if (!match) continue

      const status = match.status_type === 'finished'
        ? 'finished'
        : match.status_type === 'inprogress'
          ? (match.paused ? 'halftime' : 'live')
          : 'notstarted'

      if (status === 'notstarted') continue

      boldMatchMap.set(match.id, {
        home_score: match.home_team?.score ?? 0,
        away_score: match.away_team?.score ?? 0,
        status,
      })
    }
  } catch (e) {
    errors.push(`Bold API fejl: ${e}`)
    return { updated, errors }
  }

  const matchesStatus = (s: string) =>
    s === 'finished' ? 'finished' : s === 'halftime' ? 'halftime' : 'live'

  // Opdater kun de kampe der har nye scores
  for (const match of activeMatches) {
    if (!match.bold_match_id) continue
    const boldData = boldMatchMap.get(match.bold_match_id)
    if (!boldData) continue

    preview.push({
      league_match_id: match.id,
      home_team: match.home_team,
      away_team: match.away_team,
      home_score: boldData.home_score,
      away_score: boldData.away_score,
      status: boldData.status,
      matches_status: matchesStatus(boldData.status),
    })

    if (dryRun) {
      updated++
      continue
    }

    const { error } = await supabaseAdmin
      .from('league_matches')
      .update({
        home_score: boldData.home_score,
        away_score: boldData.away_score,
        status: boldData.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    if (error) {
      errors.push(`Opdatering fejlede for kamp ${match.id}: ${error.message}`)
    } else {
      updated++
      await supabaseAdmin
        .from('matches')
        .update({
          home_score: boldData.home_score,
          away_score: boldData.away_score,
          status: matchesStatus(boldData.status),
        })
        .eq('league_match_id', match.id)
    }
  }

  console.log(`[syncMatchScores] ${updated} kampe opdateret${dryRun ? ' (dry-run)' : ''}`)

  if (dryRun) {
    return { updated, errors, preview, raw_bold_response: rawBoldResponse }
  }
  return { updated, errors }
}
