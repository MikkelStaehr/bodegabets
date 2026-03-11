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

  // 1. Find kun kampe der KAN have scores lige nu
  // (kickoff indenfor de seneste 3 timer OG ikke allerede finished)
  const now = new Date()
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  let query = supabaseAdmin
    .from('league_matches')
    .select('id, bold_match_id, league_id, home_team, away_team, status')
    .neq('status', 'finished')

  if (boldMatchId != null) {
    query = query.eq('bold_match_id', boldMatchId)
  } else {
    query = query.lte('kickoff_at', now.toISOString()).gte('kickoff_at', threeHoursAgo.toISOString())
  }

  const { data: activeMatches, error: fetchError } = await query

  if (fetchError) {
    errors.push(`Fetch fejl: ${fetchError.message}`)
    return { updated, errors }
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
    for (const m of (data.matches ?? [])) {
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
