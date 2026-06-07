/**
 * Auto-discovery af nye sæsoner på Bold API.
 *
 * Bold offentliggør nye sæsoner (fx Premier League 26/27) ved at oprette
 * nye phase_ids. Hidtil har vi opdaget dem manuelt: scanne phase-id-range
 * → finde tournament_id-match → indsætte season-row. Denne fil automatiserer
 * processen så cron kan opdage og oprette nye sæsoner uden manuel indgriben.
 *
 * Strategi pr. tournament:
 *   1) Find vores nuværende højeste phase_id i seasons-tabellen
 *   2) Scan phase_id + 50, +100, +150, ... +1000 hos Bold
 *   3) Hvis tournament_id matcher OG første kamp er > today+30 dage,
 *      har vi fundet en kandidat. Bisect for præcis start-phase.
 *   4) Auto-generate season-name fra første kamps år
 *   5) Insert (skip hvis allerede findes)
 *
 * Rate-limit-safe: 200ms delay mellem Bold-calls. Scanner alle tournaments
 * sekventielt — ~50 sek pr. run for 18 tournaments × ~6 hops. Cron-jobbet
 * kører 1x ugentligt så det er ikke kritisk hurtigt.
 */

import { supabaseAdmin } from '@/lib/supabase'

const BOLD_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'
const DELAY_MS = 200
const SCAN_STEP = 50
const SCAN_MAX_AHEAD = 1000
const MIN_DAYS_AHEAD = 30 // sæsonens første kamp skal være > 30 dage ude

type BoldMatch = {
  match?: {
    date?: string
    tournament_id?: number
    tournament_name?: string
  }
}

async function fetchPhase(phaseId: number): Promise<{ tournamentId: number; tournamentName: string; firstDate: string } | null> {
  try {
    const res = await fetch(`${BOLD_API}?phase_ids=${phaseId}&page=1&limit=3`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json() as { matches?: BoldMatch[] }
    const matches = data.matches ?? []
    if (matches.length === 0) return null
    const first = matches[0]?.match
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
 * Auto-generate season name baseret på et eksempel-format og første kampdato.
 *
 * - Hvis seneste sæson hedder "2025/26" → ny sæson "2026/27"
 * - Hvis seneste sæson hedder "2026"    → ny sæson "2027"
 * - Hvis seneste sæson hedder "EM 2024" → "EM 2028" (cup-format hver 4. år)
 *   eller "EM 2026" hvis 2 år ude — vi lader dato afgøre
 */
function generateNextSeasonName(latestName: string, firstDateYear: number): string {
  // Format "YYYY/YY"
  const slashMatch = latestName.match(/^(\d{4})\/(\d{2})$/)
  if (slashMatch) {
    const startYear = firstDateYear
    const endYear = (startYear + 1).toString().slice(-2)
    return `${startYear}/${endYear}`
  }
  // Format "YYYY"
  const yearMatch = latestName.match(/^(\d{4})$/)
  if (yearMatch) {
    return String(firstDateYear)
  }
  // Format "Tekst YYYY" (fx "EM 2024", "FIFA VM 2026")
  const prefixMatch = latestName.match(/^(.+?)\s+(\d{4})$/)
  if (prefixMatch) {
    return `${prefixMatch[1]} ${firstDateYear}`
  }
  // Fallback
  return String(firstDateYear)
}

export type DiscoverResult = {
  ok: boolean
  scanned: number
  candidates: Array<{ tournament_id: number; tournament_name: string; new_phase: number; first_date: string; suggested_name: string; inserted: boolean }>
  errors: string[]
}

export async function discoverBoldSeasons(opts: { dryRun?: boolean } = {}): Promise<DiscoverResult> {
  const result: DiscoverResult = { ok: true, scanned: 0, candidates: [], errors: [] }
  const dryRun = !!opts.dryRun

  // 1. Hent alle seasons og udled max phase_id pr. tournament
  const { data: seasons, error } = await supabaseAdmin
    .from('seasons')
    .select('tournament_id, name, bold_phase_ids, tournaments:tournament_id(name)')
    .not('bold_phase_ids', 'is', null)
  if (error || !seasons) {
    result.ok = false
    result.errors.push(`fetch seasons: ${error?.message ?? 'unknown'}`)
    return result
  }

  type Latest = { tournament_id: number; tournamentName: string; maxPhase: number; latestSeasonName: string }
  const byTournament = new Map<number, Latest>()
  for (const s of seasons) {
    const phases = (s.bold_phase_ids as string).split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !Number.isNaN(n))
    if (phases.length === 0) continue
    const maxPhase = Math.max(...phases)
    const tName = (s.tournaments as { name?: string } | { name?: string }[] | null)
    const tourName = (Array.isArray(tName) ? tName[0]?.name : tName?.name) ?? `tid=${s.tournament_id}`
    const existing = byTournament.get(s.tournament_id as number)
    if (!existing || maxPhase > existing.maxPhase) {
      byTournament.set(s.tournament_id as number, {
        tournament_id: s.tournament_id as number,
        tournamentName: tourName,
        maxPhase,
        latestSeasonName: s.name as string,
      })
    }
  }

  const today = new Date()
  const minStart = new Date(today.getTime() + MIN_DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 2. For hver tournament: scan phase-id-range op
  for (const latest of byTournament.values()) {
    let found: { phase: number; date: string } | null = null

    for (let phaseId = latest.maxPhase + SCAN_STEP; phaseId <= latest.maxPhase + SCAN_MAX_AHEAD; phaseId += SCAN_STEP) {
      result.scanned++
      const r = await fetchPhase(phaseId)
      await new Promise((res) => setTimeout(res, DELAY_MS))
      if (!r) continue
      if (r.tournamentId !== latest.tournament_id) continue
      if (r.firstDate <= minStart) continue
      found = { phase: phaseId, date: r.firstDate }
      break
    }

    if (!found) continue

    // 3. Bisect for præcis start-phase
    let lo = latest.maxPhase
    let hi = found.phase
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      result.scanned++
      const r = await fetchPhase(mid)
      await new Promise((res) => setTimeout(res, DELAY_MS))
      if (r && r.tournamentId === latest.tournament_id && r.firstDate > minStart) {
        hi = mid
        found = { phase: mid, date: r.firstDate }
      } else {
        lo = mid
      }
    }

    // 4. Sanity check: phase findes ikke allerede i en season
    const phaseStr = String(found.phase)
    const alreadyExists = seasons.some((s) => {
      const phases = (s.bold_phase_ids as string).split(',').map((p) => p.trim())
      return phases.includes(phaseStr)
    })
    if (alreadyExists) continue

    // 5. Auto-generate name
    const firstYear = parseInt(found.date.slice(0, 4), 10)
    const suggestedName = generateNextSeasonName(latest.latestSeasonName, firstYear)

    const candidate = {
      tournament_id: latest.tournament_id,
      tournament_name: latest.tournamentName,
      new_phase: found.phase,
      first_date: found.date,
      suggested_name: suggestedName,
      inserted: false,
    }

    // 6. Insert hvis ikke dry-run
    if (!dryRun) {
      const { error: insErr } = await supabaseAdmin
        .from('seasons')
        .insert({
          tournament_id: latest.tournament_id,
          name: suggestedName,
          bold_phase_ids: phaseStr,
          is_free_event: false,
        })
      if (insErr) {
        result.errors.push(`${latest.tournamentName} → ${suggestedName}: ${insErr.message}`)
      } else {
        candidate.inserted = true
        console.log(`[discoverBoldSeasons] Ny sæson oprettet: ${latest.tournamentName} "${suggestedName}" phase=${found.phase} start=${found.date}`)
      }
    }

    result.candidates.push(candidate)
  }

  return result
}
