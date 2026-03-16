/**
 * POST /api/admin/sync-test
 * Dry-run og test af Bold sync.
 *
 * Body: { mode: 'scores' | 'fixtures' | 'match' | 'phase_info',
 *         bold_match_id?: number, league_id?: number, bold_phase_id?: number, dry_run?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { danishTimeToUtc } from '@/lib/boldApi'
import { syncMatchScores } from '@/lib/syncMatchScores'
import { syncBoldFixtures } from '@/lib/syncLeagueMatches'

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

export const maxDuration = 60

function parseMatchDate(mt: { date?: string }): string | null {
  if (!mt?.date) return null
  const ma = mt.date.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/)
  if (ma) {
    const [, date, h, m] = ma
    return danishTimeToUtc(date, `${h.padStart(2, '0')}:${m}`)
  }
  const d = mt.date.slice(0, 10)
  return danishTimeToUtc(d, '15:00')
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({})) as {
    mode?: 'scores' | 'fixtures' | 'match' | 'phase_info'
    bold_match_id?: number
    league_id?: number
    bold_phase_id?: number
    dry_run?: boolean
  }

  const mode = body.mode ?? 'scores'
  const dryRun = body.dry_run ?? true
  const start = Date.now()

  try {
    if (mode === 'phase_info') {
      const boldPhaseId = body.bold_phase_id
      if (!boldPhaseId) {
        return NextResponse.json({ error: 'bold_phase_id er påkrævet for mode=phase_info' }, { status: 400 })
      }
      const allMatches: Array<{ match: { date?: string; round?: string } }> = []
      let page = 1
      let totalPageCount = 1
      const limit = 50

      while (true) {
        const offset = (page - 1) * limit
        const url = `${BOLD_MATCHES_API}?phase_ids=${boldPhaseId}&page=${page}&limit=${limit}&offset=${offset}`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'BodegaBets/1.0', Accept: 'application/json' },
          cache: 'no-store',
        })
        if (!res.ok) {
          const elapsed_ms = Date.now() - start
          return NextResponse.json({ error: `Bold API ${res.status}`, elapsed_ms }, { status: 502 })
        }
        const data = (await res.json()) as { matches?: typeof allMatches; total_page_count?: number }
        const pageMatches = data.matches ?? []
        allMatches.push(...pageMatches)
        if (page === 1 && data.total_page_count != null) {
          totalPageCount = typeof data.total_page_count === 'number' ? data.total_page_count : parseInt(String(data.total_page_count), 10) || 1
        }
        if (page >= totalPageCount || page > 20) break
        page++
      }

      const kickoffs: string[] = []
      const byRound = new Map<string, { match_count: number; first_kickoff: string | null; last_kickoff: string | null }>()

      for (const entry of allMatches) {
        const mt = entry.match
        const kickoff = parseMatchDate(mt)
        if (kickoff) kickoffs.push(kickoff)

        const roundName = mt.round?.includes('runde') ? mt.round : mt.round ? `${mt.round}. runde` : 'Ukendt runde'
        const r = byRound.get(roundName) ?? { match_count: 0, first_kickoff: null as string | null, last_kickoff: null as string | null }
        r.match_count++
        if (kickoff) {
          r.first_kickoff = r.first_kickoff ? (kickoff < r.first_kickoff ? kickoff : r.first_kickoff) : kickoff
          r.last_kickoff = r.last_kickoff ? (kickoff > r.last_kickoff ? kickoff : r.last_kickoff) : kickoff
        }
        byRound.set(roundName, r)
      }

      const rounds = [...byRound.entries()]
        .sort((a, b) => (a[1].first_kickoff ?? '').localeCompare(b[1].first_kickoff ?? ''))
        .map(([name, v]) => ({ name, match_count: v.match_count, first_kickoff: v.first_kickoff, last_kickoff: v.last_kickoff }))

      const elapsed_ms = Date.now() - start
      return NextResponse.json({
        mode: 'phase_info',
        bold_phase_id: boldPhaseId,
        first_match_date: kickoffs.length ? [...kickoffs].sort()[0] : null,
        last_match_date: kickoffs.length ? [...kickoffs].sort().pop() : null,
        total_matches: allMatches.length,
        rounds,
        raw_bold_response: allMatches,
        elapsed_ms,
      })
    }

    if (mode === 'match') {
      const boldMatchId = body.bold_match_id
      if (!boldMatchId) {
        return NextResponse.json({ error: 'bold_match_id er påkrævet for mode=match' }, { status: 400 })
      }
      const url = `${BOLD_MATCHES_API}?match_ids=${boldMatchId}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BodegaBets/1.0', Accept: 'application/json' },
        cache: 'no-store',
      })
      const raw = await res.json().catch(() => ({}))
      const elapsed_ms = Date.now() - start
      return NextResponse.json({
        mode: 'match',
        bold_match_id: boldMatchId,
        raw_bold_response: raw,
        elapsed_ms,
      })
    }

    if (mode === 'scores') {
      const result = await syncMatchScores({
        dryRun,
        boldMatchId: body.bold_match_id,
      })
      const elapsed_ms = Date.now() - start
      return NextResponse.json({
        mode: 'scores',
        ...result,
        elapsed_ms,
      })
    }

    if (mode === 'fixtures') {
      const leagueId = body.league_id
      if (!leagueId) {
        return NextResponse.json({ error: 'league_id er påkrævet for mode=fixtures' }, { status: 400 })
      }
      const { data: league } = await supabaseAdmin
        .from('leagues')
        .select('bold_phase_id, name')
        .eq('id', leagueId)
        .single()

      if (!league?.bold_phase_id) {
        return NextResponse.json(
          { error: `Liga ${league?.name ?? leagueId} mangler bold_phase_id` },
          { status: 400 }
        )
      }

      const result = await syncBoldFixtures(leagueId, league.bold_phase_id, { dryRun })
      const elapsed_ms = Date.now() - start
      return NextResponse.json({
        mode: 'fixtures',
        league_id: leagueId,
        league_name: league.name,
        bold_phase_id: league.bold_phase_id,
        ...result,
        elapsed_ms,
      })
    }

    return NextResponse.json({ error: `Ukendt mode: ${mode}` }, { status: 400 })
  } catch (err) {
    const elapsed_ms = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg, elapsed_ms }, { status: 500 })
  }
}
