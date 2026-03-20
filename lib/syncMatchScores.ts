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
  result: string
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
      .gte('kickoff', threeHoursAgo.toISOString())
      .lte('kickoff', twentyFourHoursLater.toISOString())

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

  console.log(`[syncMatchScores] activeMatches: ${activeMatches.length} kampe`, activeMatches.map(m => m.bold_match_id))

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

  const boldMatchMap = new Map<number, { home_score: number; away_score: number; status: string; time?: number }>()
  let rawBoldResponse: unknown = null

  try {
    const url = `${BOLD_MATCHES_API}?phase_ids=${phaseIds.join(',')}&page=1&limit=1000&offset=0`
    console.log(`[syncMatchScores] Bold API URL: ${url}`)
    const res = await fetch(url, { headers: BOLD_HEADERS, cache: 'no-store' })
    console.log(`[syncMatchScores] Bold API status: ${res.status} ${res.statusText}`)

    if (!res.ok) {
      errors.push(`Bold API fejl: ${res.status} ${res.statusText}`)
      return { updated, errors }
    }

    let text = ''
    let data: { matches?: unknown[] }
    try {
      text = await res.text()
      console.log(`[syncMatchScores] Bold API response preview: ${text.slice(0, 500)}`)
      data = JSON.parse(text) as { matches?: unknown[] }
    } catch (err) {
      errors.push(`Bold API JSON fejl: ${String(err)} — response: ${text?.slice(0, 500)}`)
      return { updated, errors }
    }

    rawBoldResponse = data
    const matchesRaw = Array.isArray(data) ? data : ((data as { matches?: unknown[] }).matches ?? (data as { data?: unknown[] }).data ?? [])

    for (const m of (matchesRaw ?? []) as Array<{ match?: { id: number; status_type: string; paused?: boolean; home_team?: { score: number }; away_team?: { score: number }; time?: number; estimatedTime?: boolean } }>) {
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
        time: match.time,
      })
    }
  } catch (e) {
    errors.push(`Bold API fejl: ${e}`)
    return { updated, errors }
  }

  console.log(`[syncMatchScores] boldMatchMap size: ${boldMatchMap.size}`, [...boldMatchMap.keys()])

  const matchesStatus = (s: string) =>
    s === 'finished' ? 'finished' : s === 'halftime' ? 'halftime' : 'live'

  const finishedRoundIds = new Set<number>()

  for (const match of activeMatches) {
    const boldData = boldMatchMap.get(match.bold_match_id)
    if (!boldData) continue

    const status = matchesStatus(boldData.status)
    const result = boldData.home_score > boldData.away_score ? '1'
      : boldData.home_score === boldData.away_score ? 'X' : '2'

    preview.push({
      match_id: match.id,
      home_score: boldData.home_score,
      away_score: boldData.away_score,
      status,
      result,
    })

    if (dryRun) {
      updated++
      continue
    }

    // Pre-fetch current status to detect finished-transition
    const { data: currentMatch } = await supabaseAdmin
      .from('matches')
      .select('status')
      .eq('id', match.id)
      .single()

    // Ekstra bet resultater — opdateres live
    const h = boldData.home_score
    const a = boldData.away_score

    const updates: Record<string, unknown> = {
      home_score: h,
      away_score: a,
      status,
      result,
      current_minute: typeof boldData.time === 'number' ? boldData.time : null,
      goals_3plus_result: h >= 3 ? '1' : a >= 3 ? '2' : null,
      clean_sheet_result: a === 0 && h > 0 ? '1' : h === 0 && a > 0 ? '2' : null,
      win_margin_result: h - a >= 2 ? '1' : a - h >= 2 ? '2' : null,
      updated_at: new Date().toISOString(),
    }

    // Gem 2. halvleg starttidspunkt
    if (currentMatch?.status === 'halftime' && status === 'live') {
      updates.second_half_started_at = new Date().toISOString()
    }

    const { error } = await supabaseAdmin
      .from('matches')
      .update(updates)
      .eq('id', match.id)

    if (error) {
      errors.push(`Opdatering fejlede for kamp ${match.id}: ${error.message}`)
    } else {
      updated++
      // Kamp skiftet til finished → trigger pointberegning via round_id
      if (status === 'finished' && currentMatch?.status !== 'finished') {
        if (match.round_id) finishedRoundIds.add(match.round_id)
      }
    }
  }

  // Kør calculateRoundPoints for runder med nyligt færdige kampe
  for (const roundId of finishedRoundIds) {
    try {
      console.log(`[syncMatchScores] Kamp finished → calculateRoundPoints(${roundId})`)
      await calculateRoundPoints(roundId)
    } catch (e) {
      errors.push(`calculateRoundPoints fejl for runde ${roundId}: ${e}`)
    }
  }

  console.log(`[syncMatchScores] ${updated} kampe opdateret${dryRun ? ' (dry-run)' : ''}`)

  if (dryRun) {
    return { updated, errors, preview, raw_bold_response: rawBoldResponse }
  }

  // ─── Lås kampe der har passeret bet_lock_at ────────────────────────────────
  const { data: tolock } = await supabaseAdmin
    .from('matches')
    .select('id, round_id')
    .eq('bet_open', true)
    .lt('bet_lock_at', new Date().toISOString())

  if (tolock?.length) {
    await supabaseAdmin
      .from('matches')
      .update({ bet_open: false })
      .in('id', tolock.map((m: { id: number }) => m.id))

    // Opdater rounds.bet_open baseret på om der stadig er åbne kampe
    const roundIds = [...new Set(tolock.map((m: { round_id: number | null }) => m.round_id).filter(Boolean))] as number[]
    for (const roundId of roundIds) {
      const { data: openMatches } = await supabaseAdmin
        .from('matches')
        .select('id')
        .eq('round_id', roundId)
        .eq('bet_open', true)

      const roundBetOpen = (openMatches?.length ?? 0) > 0
      await supabaseAdmin
        .from('rounds')
        .update({ bet_open: roundBetOpen })
        .eq('id', roundId)
        .eq('status', 'open')
    }

    console.log(`[syncMatchScores] Låste ${tolock.length} kampe (bet_open=false), opdaterede ${roundIds.length} runder`)
  }

  // ─── Catch-up: find finished matches missing result ───────────────────────
  const { data: missedMatches, error: missedError } = await supabaseAdmin
    .from('matches')
    .select('id, home_score, away_score')
    .eq('status', 'finished')
    .is('result', null)
    .not('home_score', 'is', null)

  if (missedError) {
    errors.push(`Catch-up fetch fejl: ${missedError.message}`)
  } else if (missedMatches?.length) {
    console.log(`[syncMatchScores] Catch-up: ${missedMatches.length} finished kampe mangler result`)

    for (const m of missedMatches) {
      const result = m.home_score > m.away_score ? '1'
        : m.home_score === m.away_score ? 'X' : '2'

      const { error: updateErr } = await supabaseAdmin
        .from('matches')
        .update({ result })
        .eq('id', m.id)

      if (updateErr) {
        errors.push(`Catch-up update fejl for match ${m.id}: ${updateErr.message}`)
      }
    }
  }

  // ─── Catch-up: find finished rounds without point calculation ─────────────
  // Finder runder hvor alle kampe er finished med result, men round_scores mangler
  const { data: finishedWithResult, error: catchupError } = await supabaseAdmin
    .from('matches')
    .select('round_id')
    .eq('status', 'finished')
    .not('result', 'is', null)

  if (catchupError) {
    errors.push(`Catch-up rounds fetch fejl: ${catchupError.message}`)
  } else if (finishedWithResult?.length) {
    const roundIds = [...new Set(finishedWithResult.map((m) => m.round_id as number).filter(Boolean))]

    for (const catchupRoundId of roundIds) {
      if (finishedRoundIds.has(catchupRoundId)) continue

      // Tjek om round_scores allerede eksisterer for denne runde
      const { count } = await supabaseAdmin
        .from('round_scores')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', catchupRoundId)

      if (count && count > 0) continue

      // Skip runder uden bets — ingen grund til at beregne points
      const { count: betCount } = await supabaseAdmin
        .from('bets')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', catchupRoundId)

      if (!betCount || betCount === 0) continue

      try {
        console.log(`[syncMatchScores] Catch-up: calculateRoundPoints(${catchupRoundId})`)
        await calculateRoundPoints(catchupRoundId)
      } catch (e) {
        errors.push(`Catch-up calculateRoundPoints fejl for runde ${catchupRoundId}: ${e}`)
      }
    }
  }

  return { updated, errors }
}
