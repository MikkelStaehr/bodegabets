/**
 * syncMatchScores.ts — nyt skema (matches, seasons, rounds)
 *
 * Synkroniserer kun kampe der er live eller snart (scheduled med kickoff inden 24t).
 */

import { createClient } from '@supabase/supabase-js'
import { calculateRoundPoints } from '@/lib/calculatePoints'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

const BOLD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
  'Referer': 'https://www.bold.dk/',
  'Origin': 'https://www.bold.dk',
} as const

export type SyncMatchScoresPreview = Array<{
  match_id: number
  home_score: number
  away_score: number
  status: string
}>

export async function syncMatchScores(options?: {
  dryRun?: boolean
  boldMatchId?: number
}): Promise<{ updated: number; errors: string[]; preview?: SyncMatchScoresPreview; raw_bold_response?: unknown }> {
  const { dryRun = false, boldMatchId } = options ?? {}
  const errors: string[] = []
  let updated = 0
  const preview: SyncMatchScoresPreview = []

  const now = new Date()
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  let activeMatches: Array<{ id: number; bold_match_id: number; season_id: number; round_id: number | null }> = []

  if (boldMatchId != null) {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select('id, bold_match_id, season_id, round_id')
      .eq('bold_match_id', boldMatchId)
    if (error) {
      errors.push(`Fetch fejl: ${error.message}`)
      return { updated, errors }
    }
    activeMatches = (data ?? []).map((m) => ({ ...m, round_id: m.round_id ?? null }))
  } else {
    const { data: liveData } = await supabaseAdmin
      .from('matches')
      .select('id, bold_match_id, season_id, round_id')
      .in('status', ['live', 'halftime'])

    const { data: scheduledData } = await supabaseAdmin
      .from('matches')
      .select('id, bold_match_id, season_id, round_id')
      .eq('status', 'scheduled')
      .gte('kickoff_at', threeHoursAgo.toISOString())
      .lte('kickoff_at', twentyFourHoursLater.toISOString())

    const seen = new Set<number>()
    for (const m of [...(liveData ?? []), ...(scheduledData ?? [])]) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      activeMatches.push({
        id: m.id,
        bold_match_id: m.bold_match_id,
        season_id: m.season_id,
        round_id: m.round_id ?? null,
      })
    }
  }

  if (!activeMatches.length) {
    console.log('[syncMatchScores] Ingen aktive kampe lige nu')
    return { updated, errors }
  }

  const boldMatchIds = new Set(activeMatches.map((m) => m.bold_match_id))

  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('id, bold_phase_id')
    .in('id', [...new Set(activeMatches.map((m) => m.season_id))])
    .not('bold_phase_id', 'is', null)

  const phaseIds = (seasons ?? []).map((s) => s.bold_phase_id).filter((id): id is number => id != null)

  if (!phaseIds.length) {
    errors.push('Ingen sæsoner med bold_phase_id for aktive kampe')
    return { updated, errors }
  }

  const boldMatchMap = new Map<number, { home_score: number; away_score: number; status: string }>()
  let rawBoldResponse: unknown = null

  try {
    const url = `${BOLD_MATCHES_API}?phase_ids=${phaseIds.join(',')}&page=1&limit=1000&offset=0`
    const res = await fetch(url, { headers: BOLD_HEADERS, cache: 'no-store' })

    if (!res.ok) {
      errors.push(`Bold API fejl: ${res.status} ${res.statusText}`)
      return { updated, errors }
    }

    let text = ''
    let data: { matches?: unknown[] }
    try {
      text = await res.text()
      data = JSON.parse(text) as { matches?: unknown[] }
    } catch (err) {
      errors.push(`Bold API JSON fejl: ${String(err)} — response: ${text?.slice(0, 500)}`)
      return { updated, errors }
    }

    rawBoldResponse = data
    const matchesRaw = Array.isArray(data) ? data : ((data as { matches?: unknown[] }).matches ?? (data as { data?: unknown[] }).data ?? [])

    for (const m of (matchesRaw ?? []) as Array<{ match?: { id: number; status_type: string; paused?: boolean; home_team?: { score: number }; away_team?: { score: number } } }>) {
      const match = m.match
      if (!match || !boldMatchIds.has(match.id)) continue

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

  const finishedRoundIds = new Set<number>()

  for (const match of activeMatches) {
    const boldData = boldMatchMap.get(match.bold_match_id)
    if (!boldData) continue

    preview.push({
      match_id: match.id,
      home_score: boldData.home_score,
      away_score: boldData.away_score,
      status: boldData.status,
    })

    if (dryRun) {
      updated++
      continue
    }

    const { data: currentMatch } = await supabaseAdmin
      .from('matches')
      .select('status, round_id')
      .eq('id', match.id)
      .single()

    const { error } = await supabaseAdmin
      .from('matches')
      .update({
        home_score: boldData.home_score,
        away_score: boldData.away_score,
        status: matchesStatus(boldData.status),
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    if (error) {
      errors.push(`Opdatering fejlede for kamp ${match.id}: ${error.message}`)
    } else {
      updated++
      if (boldData.status === 'finished' && currentMatch?.round_id && currentMatch.status !== 'finished') {
        finishedRoundIds.add(currentMatch.round_id)
      }
    }
  }

  for (const roundId of finishedRoundIds) {
    console.log(`[syncMatchScores] Kamp finished → trigger calculateRoundPoints(${roundId})`)
    await calculateRoundPoints(roundId)
  }

  console.log(`[syncMatchScores] ${updated} kampe opdateret${dryRun ? ' (dry-run)' : ''}`)

  if (dryRun) {
    return { updated, errors, preview, raw_bold_response: rawBoldResponse }
  }
  return { updated, errors }
}
