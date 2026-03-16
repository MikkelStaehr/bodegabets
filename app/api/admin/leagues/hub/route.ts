import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

/** GET — returnerer turneringer + sæsoner til LeagueHubClient (nyt skema) */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data: tournamentsRows } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, country, bold_slug, bold_id, type, is_active')
    .order('name')

  if (!tournamentsRows?.length) {
    return NextResponse.json({ leagues: [], logs: [] })
  }

  const tournamentIds = tournamentsRows.map((t) => t.id as number)

  // Hent aktive sæsoner per turnering (med bold_phase_id for sync)
  const { data: seasonsRows } = await supabaseAdmin
    .from('seasons')
    .select('id, tournament_id, bold_phase_id, name')
    .in('tournament_id', tournamentIds)
    .eq('is_active', true)

  const seasonIds = (seasonsRows ?? []).map((s) => s.id as number)

  // Tæl matches per sæson
  const { data: matchCounts } = seasonIds.length
    ? await supabaseAdmin
        .from('matches')
        .select('season_id')
        .in('season_id', seasonIds)
    : { data: [] }

  const countBySeason = new Map<number, number>()
  for (const m of matchCounts ?? []) {
    const sid = (m as { season_id: number }).season_id
    countBySeason.set(sid, (countBySeason.get(sid) ?? 0) + 1)
  }

  const countByTournament = new Map<number, number>()
  for (const s of seasonsRows ?? []) {
    const tid = s.tournament_id as number
    const sid = s.id as number
    const c = countBySeason.get(sid) ?? 0
    countByTournament.set(tid, (countByTournament.get(tid) ?? 0) + c)
  }

  // Returnér som "leagues" for bagudkompatibilitet med LeagueHubClient
  // id = tournament_id, men sync bruger season_id fra første aktive sæson
  const seasonByTournament = new Map<number, { id: number; bold_phase_id: number | null }>()
  for (const s of seasonsRows ?? []) {
    const tid = s.tournament_id as number
    if (!seasonByTournament.has(tid)) {
      seasonByTournament.set(tid, { id: s.id as number, bold_phase_id: s.bold_phase_id ?? null })
    }
  }

  const leagues = tournamentsRows.map((t) => {
    const tid = t.id as number
    const season = seasonByTournament.get(tid)
    return {
      id: tid,
      name: t.name,
      country: t.country ?? '',
      bold_slug: t.bold_slug ?? null,
      fixturedownload_slug: null,
      last_synced_at: null,
      bold_phase_id: season?.bold_phase_id ?? null,
      total_matches: countByTournament.get(tid) ?? 0,
      season_id: season?.id ?? null,
    }
  })

  let logs: { id: number; league_id: number; synced_at: string; matches_imported: number; status: string; message: string }[] = []
  try {
    const { data: logRows } = await supabaseAdmin
      .from('admin_logs')
      .select('id, metadata, created_at')
      .eq('type', 'sync_fixtures')
      .order('created_at', { ascending: false })
      .limit(200)

    logs = (logRows ?? []).map((r, i) => {
      const meta = (r as { metadata?: { matches_created?: number } }).metadata ?? {}
      return {
        id: (r as { id?: number }).id ?? i,
        league_id: 0,
        synced_at: (r as { created_at?: string }).created_at ?? new Date().toISOString(),
        matches_imported: meta.matches_created ?? 0,
        status: 'ok',
        message: `Sync: ${meta.matches_created ?? 0} kampe`,
      }
    })
  } catch {
    // admin_logs kan have anden struktur
  }

  return NextResponse.json({ leagues, logs })
}
