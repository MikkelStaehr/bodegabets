import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

/** GET — returnerer ligaer + sync-logs til LeagueHubClient */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data: leaguesRows } = await supabaseAdmin
    .from('leagues')
    .select('id, name, country, bold_slug, fixturedownload_slug, last_synced_at, bold_phase_id')
    .order('name')

  if (!leaguesRows?.length) {
    return NextResponse.json({ leagues: [], logs: [] })
  }

  const leagueIds = leaguesRows.map((l) => l.id as number)
  const { data: matchCounts } = await supabaseAdmin
    .from('league_matches')
    .select('league_id')
    .in('league_id', leagueIds)

  const countByLeague = new Map<number, number>()
  for (const m of matchCounts ?? []) {
    const lid = (m as { league_id: number }).league_id
    countByLeague.set(lid, (countByLeague.get(lid) ?? 0) + 1)
  }

  const leagues = leaguesRows.map((l) => ({
    id: l.id,
    name: l.name,
    country: l.country ?? '',
    bold_slug: l.bold_slug ?? null,
    fixturedownload_slug: l.fixturedownload_slug ?? null,
    last_synced_at: l.last_synced_at ?? null,
    bold_phase_id: l.bold_phase_id ?? null,
    total_matches: countByLeague.get(l.id as number) ?? 0,
  }))

  let logs: { id: number; league_id: number; synced_at: string; matches_imported: number; status: string; message: string }[] = []
  try {
    const { data: logRows } = await supabaseAdmin
      .from('league_sync_logs')
      .select('id, league_id, synced_at, matches_imported, status, message')
      .order('synced_at', { ascending: false })
      .limit(200)
    logs = (logRows ?? []).map((r) => ({
      id: r.id as number,
      league_id: r.league_id as number,
      synced_at: r.synced_at as string,
      matches_imported: (r.matches_imported as number) ?? 0,
      status: (r.status as string) ?? 'ok',
      message: (r.message as string) ?? '',
    }))
  } catch {
    // league_sync_logs findes muligvis ikke
  }

  return NextResponse.json({ leagues, logs })
}
