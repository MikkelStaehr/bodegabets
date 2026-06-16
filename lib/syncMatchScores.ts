/**
 * syncMatchScores.ts — nyt skema (matches, seasons, rounds)
 *
 * Synkroniserer kun kampe der er live eller snart (scheduled med kickoff inden 24t).
 */

import { createClient } from '@supabase/supabase-js'
import { calculateRoundPoints, calculateChampionshipRoundPoints } from '@/lib/calculatePoints'
import { updateBlockStatuses, evaluateFinishedBlocks } from '@/lib/evaluateBlocks'
import { lockBlockBetConsensus } from '@/lib/lockBlockBets'
import { lazyProxy } from '@/lib/lazyProxy'

// Lazy (se lib/lazyProxy): klienten oprettes først ved brug, ikke ved
// module-load — så `next build` ikke kræver service-role-key.
const supabaseAdmin = lazyProxy(() =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000)
  const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // ─── Lås kampe hvor bet_lock_at er passeret (standalone, kører først) ─────
  const { data: toLock } = await supabaseAdmin
    .from('matches')
    .select('id, round_id, home_team_id, away_team_id')
    .eq('bet_open', true)
    .lt('bet_lock_at', now.toISOString())

  if (toLock && toLock.length > 0) {
    const { error: lockError } = await supabaseAdmin
      .from('matches')
      .update({ bet_open: false })
      .in('id', toLock.map((m) => m.id))

    if (lockError) {
      console.error('[syncMatchScores] Bet-lock UPDATE fejl:', lockError)
    }

    // Beregn og gem konsensus odds for alle match_result-bets på de låste kampe
    if (!dryRun) {
      const lockedMatchIds = toLock.map((m) => m.id)

      // Find rivalry-kampe i én query
      const allTeamIds = [...new Set(
        toLock.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((id): id is number => id != null)
      )]
      const rivalryMatchIds = new Set<number>()
      if (allTeamIds.length > 0) {
        const { data: rivalries } = await supabaseAdmin
          .from('rivalries')
          .select('team_id, rival_team_id')
          .in('team_id', allTeamIds)
          .in('rival_team_id', allTeamIds)

        const rivalryPairs = new Set<string>(
          (rivalries ?? []).map((r) => `${r.team_id}:${r.rival_team_id}`)
        )
        for (const m of toLock) {
          if (
            m.home_team_id != null && m.away_team_id != null &&
            (rivalryPairs.has(`${m.home_team_id}:${m.away_team_id}`) ||
             rivalryPairs.has(`${m.away_team_id}:${m.home_team_id}`))
          ) {
            rivalryMatchIds.add(m.id)
          }
        }
      }

      const { data: lockedBets } = await supabaseAdmin
        .from('bets')
        .select('id, match_id, game_id, prediction')
        .in('match_id', lockedMatchIds)
        .eq('bet_type', 'match_result')

      if (lockedBets?.length) {
        // Gruppér per match + game
        const groups = new Map<string, typeof lockedBets>()
        for (const bet of lockedBets) {
          const key = `${bet.match_id}:${bet.game_id}`
          const group = groups.get(key) ?? []
          group.push(bet)
          groups.set(key, group)
        }

        for (const groupBets of groups.values()) {
          const total = groupBets.length
          const count: Record<string, number> = { '1': 0, 'X': 0, '2': 0 }
          for (const bet of groupBets) {
            if (bet.prediction in count) count[bet.prediction]++
          }

          const isRivalry = rivalryMatchIds.has(groupBets[0].match_id)
          const [minOdds, baseOdds] = isRivalry ? [2.2, 2.8] : [1.2, 1.8]

          const calcOdds = (pred: string): number => {
            const n = count[pred] ?? 0
            if (total === 0 || n === 0) return baseOdds
            const pct = n / total
            return Math.round(Math.max(minOdds, baseOdds - pct * 0.6) * 100) / 100
          }

          for (const bet of groupBets) {
            await supabaseAdmin
              .from('bets')
              .update({ odds: calcOdds(bet.prediction) })
              .eq('id', bet.id)
          }
        }

      }

      // Beregn konsensus odds for ekstra bets (goals_3plus, clean_sheet, win_margin)
      const extraBetTypes = ['goals_3plus', 'clean_sheet', 'win_margin']
      for (const betType of extraBetTypes) {
        const { data: extraBets } = await supabaseAdmin
          .from('bets')
          .select('id, match_id, game_id, prediction')
          .in('match_id', lockedMatchIds)
          .eq('bet_type', betType)

        if (!extraBets?.length) continue

        // Gruppér per match + game
        const groups = new Map<string, typeof extraBets>()
        for (const bet of extraBets) {
          const key = `${bet.match_id}:${bet.game_id}`
          const group = groups.get(key) ?? []
          group.push(bet)
          groups.set(key, group)
        }

        for (const groupBets of groups.values()) {
          const total = groupBets.length
          const count: Record<string, number> = { '1': 0, '2': 0 }
          for (const bet of groupBets) {
            if (bet.prediction in count) count[bet.prediction]++
          }

          // Ekstra-bets giver MINDRE odds end hoved-bettet (1/X/2 = 1,2–1,8) —
          // de skal blot være et lille tillæg til sejren. Range 1,2–1,5.
          const calcOdds = (pred: string): number => {
            const n = count[pred] ?? 0
            if (total === 0 || n === 0) return 1.5
            const pct = n / total
            return Math.round(Math.max(1.2, 1.5 - pct * 0.3) * 100) / 100
          }

          for (const bet of groupBets) {
            await supabaseAdmin
              .from('bets')
              .update({ odds: calcOdds(bet.prediction) })
              .eq('id', bet.id)
          }
        }

      }

      // 🎯 Blok Bets: når kampe låser, sæt konsensus-odds for de(n) berørte
      // blok(ke) (idempotent — kører kun reelt når blokkens første kamp er låst).
      const lockedRoundIds = [...new Set(toLock.map((m) => m.round_id).filter(Boolean))]
      if (lockedRoundIds.length > 0) {
        const { data: lockedRounds } = await supabaseAdmin
          .from('rounds').select('block_id').in('id', lockedRoundIds)
        const blockIds = [...new Set((lockedRounds ?? []).map((r) => r.block_id).filter((b): b is number => b != null))]
        for (const blockId of blockIds) {
          try {
            await lockBlockBetConsensus(blockId)
          } catch (e) {
            console.error(`[syncMatchScores] lockBlockBetConsensus fejl for block ${blockId}:`, e)
          }
        }
      }
    }

    // Opdater rounds.bet_open baseret på om der stadig er åbne kampe
    const roundIds = [...new Set(toLock.map((m) => m.round_id).filter(Boolean))]
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
    }

  }

  // Hent kun round_ids fra aktive spil
  const { data: activeGameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id, games!inner(status)')
    .eq('games.status', 'active')

  const activeSeasonIds = [...new Set((activeGameSeasons ?? []).map(gs => gs.season_id as number))]

  const { data: activeRounds } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .in('season_id', activeSeasonIds.length > 0 ? activeSeasonIds : [0])

  const activeRoundIds = (activeRounds ?? []).map(r => r.id as number)

  // Championship match IDs — via championship_round_matches for aktive,
  // ikke-færdige championship rounds i aktive games
  const { data: champMatchRows } = await supabaseAdmin
    .from('championship_round_matches')
    .select('match_id, championship_rounds!inner(status, game_id, games!inner(status))')
    .neq('championship_rounds.status', 'finished')
    .eq('championship_rounds.games.status', 'active')

  const championshipMatchIds = [...new Set(
    (champMatchRows ?? []).map((r) => r.match_id as number).filter(Boolean)
  )]

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
    type MatchRow = { id: number; bold_match_id: number; season_id: number; round_id: number | null }
    const regularRoundFilter = activeRoundIds.length > 0 ? activeRoundIds : [0]
    const seen = new Set<number>()

    const addRows = (rows: MatchRow[] | null | undefined) => {
      for (const m of rows ?? []) {
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

    // Regular: live/halftime + snart-scheduled i aktive rounds
    const { data: liveData } = await supabaseAdmin
      .from('matches')
      .select('id, bold_match_id, season_id, round_id')
      .in('status', ['live', 'halftime'])
      .in('round_id', regularRoundFilter)
    addRows(liveData as MatchRow[] | null)

    const { data: scheduledData } = await supabaseAdmin
      .from('matches')
      .select('id, bold_match_id, season_id, round_id')
      .eq('status', 'scheduled')
      .gte('kickoff', eightHoursAgo.toISOString())
      .lte('kickoff', twentyFourHoursLater.toISOString())
      .in('round_id', regularRoundFilter)
    addRows(scheduledData as MatchRow[] | null)

    // Championship: samme status-filter, men via championshipMatchIds
    if (championshipMatchIds.length > 0) {
      const { data: champLive } = await supabaseAdmin
        .from('matches')
        .select('id, bold_match_id, season_id, round_id')
        .in('status', ['live', 'halftime'])
        .in('id', championshipMatchIds)
      addRows(champLive as MatchRow[] | null)

      const { data: champScheduled } = await supabaseAdmin
        .from('matches')
        .select('id, bold_match_id, season_id, round_id')
        .eq('status', 'scheduled')
        .gte('kickoff', eightHoursAgo.toISOString())
        .lte('kickoff', twentyFourHoursLater.toISOString())
        .in('id', championshipMatchIds)
      addRows(champScheduled as MatchRow[] | null)
    }
  }

  if (!activeMatches.length) {
    return { updated, errors }
  }

  const boldMatchIds = new Set(activeMatches.map((m) => m.bold_match_id))

  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('id, bold_phase_ids')
    .in('id', [...new Set(activeMatches.map((m) => m.season_id))])
    .not('bold_phase_ids', 'is', null) as { data: Array<{ id: number; bold_phase_ids: string | null }> | null }

  // bold_phase_ids (text) kan indeholde flere komma-separerede IDs ("22620,22621")
  // for multi-phase sæsoner som VM/EM, eller bare en enkelt id for almindelige ligaer.
  const phaseIdSet = new Set<string>()
  for (const s of seasons ?? []) {
    if (!s.bold_phase_ids) continue
    for (const id of s.bold_phase_ids.split(',')) {
      const trimmed = id.trim()
      if (trimmed) phaseIdSet.add(trimmed)
    }
  }
  const phaseIds = [...phaseIdSet]

  if (!phaseIds.length) {
    errors.push('Ingen sæsoner med bold_phase_ids for aktive kampe')
    return { updated, errors }
  }

  const boldMatchMap = new Map<number, { home_score: number; away_score: number; status: string; time?: number }>()
  let rawBoldResponse: unknown = null

  try {
    const url = `${BOLD_MATCHES_API}?phase_ids=${phaseIds.join(',')}&page=1&limit=1000&offset=0&include_live=true`
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

  const matchesStatus = (s: string) =>
    s === 'finished' ? 'finished' : s === 'halftime' ? 'halftime' : 'live'

  const finishedRoundIds = new Set<number>()
  const finishedMatchIds = new Set<number>()

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
      clean_sheet_result: a === 0 ? '1' : h === 0 ? '2' : null,
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
      // Kamp skiftet til finished → trigger pointberegning
      if (status === 'finished' && currentMatch?.status !== 'finished') {
        if (match.round_id) finishedRoundIds.add(match.round_id)
        finishedMatchIds.add(match.id)
      }
    }
  }

  // Kør calculateRoundPoints for runder med nyligt færdige kampe
  for (const roundId of finishedRoundIds) {
    try {
      await calculateRoundPoints(roundId)
    } catch (e) {
      errors.push(`calculateRoundPoints fejl for runde ${roundId}: ${e}`)
    }
  }

  // Trigger championship-pointberegning for championship rounds
  // hvor mindst én kamp netop er flippet til finished
  if (finishedMatchIds.size > 0) {
    const { data: affectedChampRounds } = await supabaseAdmin
      .from('championship_round_matches')
      .select('championship_round_id')
      .in('match_id', [...finishedMatchIds])

    const champRoundIds = [...new Set(
      (affectedChampRounds ?? []).map((r) => r.championship_round_id as number).filter(Boolean)
    )]
    for (const crId of champRoundIds) {
      try {
        await calculateChampionshipRoundPoints(crId)
      } catch (e) {
        errors.push(`calculateChampionshipRoundPoints fejl for round ${crId}: ${e}`)
      }
    }
  }

  // Opdater block-statuser og evaluer færdige blocks
  if (finishedRoundIds.size > 0 && !dryRun) {
    const seasonIdsForBlocks = [...new Set(
      activeMatches
        .filter((m) => m.round_id !== null && finishedRoundIds.has(m.round_id))
        .map((m) => m.season_id)
    )]
    for (const sid of seasonIdsForBlocks) {
      await updateBlockStatuses(sid)
      await evaluateFinishedBlocks(sid)
    }
  }

  if (dryRun) {
    return { updated, errors, preview, raw_bold_response: rawBoldResponse }
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
        await calculateRoundPoints(catchupRoundId)
      } catch (e) {
        errors.push(`Catch-up calculateRoundPoints fejl for runde ${catchupRoundId}: ${e}`)
      }
    }

    // Opdater block-statuser og evaluer færdige blocks for catch-up sæsoner
    if (!dryRun) {
      const catchupSeasonIds = [...new Set(
        activeMatches.map((m) => m.season_id)
      )]
      for (const sid of catchupSeasonIds) {
        await updateBlockStatuses(sid)
        await evaluateFinishedBlocks(sid)
      }
    }
  }

  return { updated, errors }
}
