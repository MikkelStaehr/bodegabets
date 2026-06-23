/**
 * Auto-discovery af nye sæsoner på Bold API.
 *
 * Bold offentliggør nye sæsoner (fx Premier League 26/27) ved at oprette nye
 * phase_ids. Dette modul scanner Bold og opretter automatisk season-rows så de
 * dukker op i game-creation UI uden manuel indgriben.
 *
 * VIGTIGT — Bolds tournament_id ≠ vores interne tournament_id.
 *   Vores Superligaen = 2, men Bolds = 115. Premier League = 1 vs 361.
 *   Derfor udleder vi Bolds tournament_id pr. liga ved at hente en kendt phase
 *   og læse `tournament_id` fra svaret. ALT matchning sker på Bold-id'et;
 *   season-rows indsættes med vores interne tournament_id.
 *
 * Strategi:
 *   1) Byg map: bold_tid → vores liga (via hver ligas nuværende phase)
 *   2) Find Bolds aktuelle phase-frontier (højeste phase med data) dynamisk —
 *      ingen fast øvre grænse, så det virker uanset hvor langt Bolds numre
 *      er drevet foran vores.
 *   3) Sweep phase-båndet (lidt under vores max → frontier), match på bold_tid
 *      + fremtidig første-kampdato, og tag den laveste kvalificerende phase
 *      pr. liga.
 *   4) Auto-generér sæsonnavn og insert (skip hvis phase/navn allerede findes).
 *
 * Begrænsning: kun single-phase ligaer. Multi-phase events (VM/EM med
 * komma-separerede phases) springes over og oprettes manuelt.
 */

import { supabaseAdmin } from '@/lib/supabase'

const BOLD_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'
const DELAY_MS = 100
const SCAN_BELOW = 150 // start sweep lidt under vores max (fanger phases der ligger lige under frontier)
const FRONTIER_STRIDE = 100 // grov stride når frontier søges
const FRONTIER_STOP_NULLS = 6 // antal sammenhængende tomme grov-hop før frontier antages
const FRONTIER_MAX_AHEAD = 8000 // hård sikkerhedsgrænse for frontier-søgning
const MIN_DAYS_AHEAD = 30 // sæsonens første kamp skal være > 30 dage ude

type BoldMatch = {
  match?: {
    date?: string
    tournament_id?: number
    tournament_name?: string
  }
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

async function fetchPhase(
  phaseId: number,
): Promise<{ tournamentId: number; tournamentName: string; firstDate: string } | null> {
  try {
    const res = await fetch(`${BOLD_API}?phase_ids=${phaseId}&page=1&limit=3`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { matches?: BoldMatch[] }
    const first = data.matches?.[0]?.match
    if (!first?.tournament_id || !first.date) return null
    return {
      tournamentId: first.tournament_id,
      tournamentName: first.tournament_name ?? '?',
      firstDate: first.date.slice(0, 10),
    }
  } catch {
    return null
  }
}

/**
 * Auto-generér sæsonnavn ud fra seneste navn og første kampdato.
 * "2025/26" → "2026/27" · "2026" → "2027" · "EM 2024" → "EM 2028"
 */
function generateNextSeasonName(latestName: string, firstDateYear: number): string {
  const slashMatch = latestName.match(/^(\d{4})\/(\d{2})$/)
  if (slashMatch) {
    const startYear = firstDateYear
    const endYear = (startYear + 1).toString().slice(-2)
    return `${startYear}/${endYear}`
  }
  if (/^(\d{4})$/.test(latestName)) return String(firstDateYear)
  const prefixMatch = latestName.match(/^(.+?)\s+(\d{4})$/)
  if (prefixMatch) return `${prefixMatch[1]} ${firstDateYear}`
  return String(firstDateYear)
}

export type DiscoverResult = {
  ok: boolean
  scanned: number
  candidates: Array<{
    tournament_id: number
    tournament_name: string
    new_phase: number
    first_date: string
    suggested_name: string
    inserted: boolean
  }>
  errors: string[]
}

/**
 * Find Bolds aktuelle phase-frontier: grov stride opad indtil flere
 * sammenhængende hop returnerer tomt (= ingen data endnu). Nye sæsoner ligger
 * altid ≤ frontier, så et sweep op til frontier garanterer at fange dem.
 */
async function findFrontier(startPhase: number, onScan: () => void): Promise<number> {
  let lastValid = startPhase
  let consecutiveNull = 0
  for (let p = startPhase; p <= startPhase + FRONTIER_MAX_AHEAD; p += FRONTIER_STRIDE) {
    onScan()
    const r = await fetchPhase(p)
    await sleep(DELAY_MS)
    if (r) {
      lastValid = p
      consecutiveNull = 0
    } else if (++consecutiveNull >= FRONTIER_STOP_NULLS) {
      break
    }
  }
  return lastValid + FRONTIER_STRIDE
}

export async function discoverBoldSeasons(opts: { dryRun?: boolean } = {}): Promise<DiscoverResult> {
  const result: DiscoverResult = { ok: true, scanned: 0, candidates: [], errors: [] }
  const dryRun = !!opts.dryRun
  const onScan = () => { result.scanned++ }

  // 1. Hent alle seasons
  const { data: seasons, error } = await supabaseAdmin
    .from('seasons')
    .select('tournament_id, name, bold_phase_ids, tournaments:tournament_id(name)')
    .not('bold_phase_ids', 'is', null)
  if (error || !seasons) {
    result.ok = false
    result.errors.push(`fetch seasons: ${error?.message ?? 'unknown'}`)
    return result
  }

  // 2. Aggregér pr. vores tournament. Multi-phase ligaer (komma) ekskluderes.
  type Agg = {
    ourTid: number
    tourName: string
    latestSeasonName: string
    maxPhase: number
    multiPhase: boolean
  }
  const byTournament = new Map<number, Agg>()
  const existingPhases = new Set<string>()
  let globalMax = 0

  for (const s of seasons) {
    const raw = String(s.bold_phase_ids ?? '')
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
    const phases = parts.map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n))
    if (phases.length === 0) continue
    for (const p of parts) existingPhases.add(p)
    const maxPhase = Math.max(...phases)
    globalMax = Math.max(globalMax, maxPhase)

    const tName = s.tournaments as { name?: string } | { name?: string }[] | null
    const tourName = (Array.isArray(tName) ? tName[0]?.name : tName?.name) ?? `tid=${s.tournament_id}`
    const ourTid = s.tournament_id as number
    const existing = byTournament.get(ourTid)
    if (!existing || maxPhase > existing.maxPhase) {
      byTournament.set(ourTid, {
        ourTid,
        tourName,
        latestSeasonName: s.name as string,
        maxPhase,
        multiPhase: existing?.multiPhase || parts.length > 1,
      })
    } else if (parts.length > 1) {
      existing.multiPhase = true
    }
  }

  // 3. Udled Bolds tournament_id pr. liga via dens nuværende phase
  const boldTidToOurs = new Map<number, Agg>()
  for (const agg of byTournament.values()) {
    if (agg.multiPhase) continue // multi-phase events oprettes manuelt
    onScan()
    const info = await fetchPhase(agg.maxPhase)
    await sleep(DELAY_MS)
    if (!info) {
      result.errors.push(`kunne ikke udlede bold_tid for ${agg.tourName} (phase ${agg.maxPhase})`)
      continue
    }
    boldTidToOurs.set(info.tournamentId, agg)
  }

  if (boldTidToOurs.size === 0) {
    result.errors.push('ingen bold_tid kunne udledes — afbryder')
    result.ok = false
    return result
  }

  const today = new Date()
  const minStart = new Date(today.getTime() + MIN_DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10)

  // 4. Find Bolds frontier og sweep båndet
  const sweepFrom = Math.max(1, globalMax - SCAN_BELOW)
  const frontier = await findFrontier(globalMax, onScan)

  // laveste kvalificerende phase pr. liga
  const found = new Map<number, { phase: number; date: string }>()
  for (let p = sweepFrom; p <= frontier; p++) {
    if (existingPhases.has(String(p))) continue
    onScan()
    const r = await fetchPhase(p)
    await sleep(DELAY_MS)
    if (!r) continue
    const agg = boldTidToOurs.get(r.tournamentId)
    if (!agg) continue
    if (r.firstDate <= minStart) continue
    if (!found.has(agg.ourTid)) {
      found.set(agg.ourTid, { phase: p, date: r.firstDate })
    }
  }

  // 5. Opret season-rows
  for (const [ourTid, hit] of found) {
    const agg = byTournament.get(ourTid)!
    const firstYear = parseInt(hit.date.slice(0, 4), 10)
    const suggestedName = generateNextSeasonName(agg.latestSeasonName, firstYear)

    // Guard: findes der allerede en season med dette navn for ligaen?
    const nameExists = seasons.some(
      (s) => (s.tournament_id as number) === ourTid && (s.name as string) === suggestedName,
    )
    if (nameExists) continue

    const candidate = {
      tournament_id: ourTid,
      tournament_name: agg.tourName,
      new_phase: hit.phase,
      first_date: hit.date,
      suggested_name: suggestedName,
      inserted: false,
    }

    if (!dryRun) {
      const { error: insErr } = await supabaseAdmin.from('seasons').insert({
        tournament_id: ourTid,
        name: suggestedName,
        bold_phase_ids: String(hit.phase),
        is_free_event: false,
      })
      if (insErr) {
        result.errors.push(`${agg.tourName} → ${suggestedName}: ${insErr.message}`)
      } else {
        candidate.inserted = true
        console.log(
          `[discoverBoldSeasons] Ny sæson oprettet: ${agg.tourName} "${suggestedName}" phase=${hit.phase} start=${hit.date}`,
        )
      }
    }

    result.candidates.push(candidate)
  }

  return result
}
