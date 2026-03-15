/**
 * GET /api/admin/leagues/sync-phases
 *
 * Automatisk opdater bold_phase_id på seasons ved sæsonskifte.
 * Tjekker om nuværende phase har fremtidige kampe; hvis ikke, prøver phase_id+1..+20.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

const BOLD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Referer': 'https://www.bold.dk/',
  'Origin': 'https://www.bold.dk',
  'Accept': 'application/json',
} as const

type BoldMatchItem = {
  match?: {
    date?: string
    kickoff?: string
    matchDate?: string
    startDate?: string
  }
  date?: string
  kickoff?: string
}

async function fetchMatches(phaseId: number): Promise<BoldMatchItem[]> {
  const url = `${BOLD_MATCHES_API}?phase_ids=${phaseId}&page=1&limit=100&offset=0`
  const res = await fetch(url, { headers: BOLD_HEADERS, cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  const raw = data.matches ?? data.data ?? (Array.isArray(data) ? data : [])
  return Array.isArray(raw) ? raw : []
}

function getKickoff(m: BoldMatchItem): Date | null {
  const d =
    m.match?.kickoff ??
    m.match?.date ??
    m.match?.matchDate ??
    m.match?.startDate ??
    m.kickoff ??
    m.date
  if (!d) return null
  const parsed = new Date(d)
  return isNaN(parsed.getTime()) ? null : parsed
}

function countFutureMatches(matches: BoldMatchItem[], now: Date): number {
  return matches.filter((m) => {
    const k = getKickoff(m)
    return k && k > now
  }).length
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const now = new Date()
  const results: { tournament: string; old_phase_id: number; new_phase_id: number | null; status: string }[] = []

  const { data: seasons, error: seasonsError } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament_id, bold_phase_id, tournaments(name)')
    .eq('is_active', true)
    .not('bold_phase_id', 'is', null)

  if (seasonsError || !seasons?.length) {
    return NextResponse.json({ checked: 0, updated: 0, results: [] })
  }

  let updated = 0

  for (const season of seasons) {
    const phaseId = season.bold_phase_id as number
    const tournament = (season.tournaments as { name?: string })?.name ?? `Tournament ${season.tournament_id}`

    const matches = await fetchMatches(phaseId)
    const futureCount = countFutureMatches(matches, now)

    if (futureCount > 0) {
      results.push({
        tournament,
        old_phase_id: phaseId,
        new_phase_id: phaseId,
        status: 'ok',
      })
      continue
    }

    let newPhaseId: number | null = null
    for (let i = 1; i <= 20; i++) {
      const candidate = phaseId + i
      const candidateMatches = await fetchMatches(candidate)
      const candidateFuture = countFutureMatches(candidateMatches, now)
      if (candidateFuture > 0) {
        newPhaseId = candidate
        break
      }
    }

    if (newPhaseId != null) {
      const { error: updateError } = await supabaseAdmin
        .from('seasons')
        .update({ bold_phase_id: newPhaseId })
        .eq('id', season.id)

      if (!updateError) {
        updated++
        results.push({
          tournament,
          old_phase_id: phaseId,
          new_phase_id: newPhaseId,
          status: 'updated',
        })
      } else {
        results.push({
          tournament,
          old_phase_id: phaseId,
          new_phase_id: newPhaseId,
          status: 'update_failed',
        })
      }
    } else {
      results.push({
        tournament,
        old_phase_id: phaseId,
        new_phase_id: null,
        status: 'no_future',
      })
    }
  }

  return NextResponse.json({
    checked: results.length,
    updated,
    results,
  })
}
