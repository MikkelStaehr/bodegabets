/**
 * GET /api/admin/team-xref
 * Henter alle hold fra team_xref grupperet per liga.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_TOURNAMENT_BY_LEAGUE_ID: Record<number, number> = {
  1: 361,   // Premier League
  2: 115,   // Superligaen
  3: 422,   // La Liga
  4: 472,   // Bundesliga
  5: 225,   // Serie A
  6: 165,   // Ligue 1
  7: 75,    // Champions League
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { data: rows } = await supabaseAdmin
      .from('team_xref')
      .select(`
        bb_team_id,
        bb_team_name,
        bb_league_id,
        bold_team_id,
        bold_tournament_id,
        league:leagues!bb_league_id ( id, name, country )
      `)
      .order('bb_league_id')
      .order('bb_team_name')

    let leaguesData: { id: number; name: string; bold_phase_id?: number | null }[] | null = null
    const leagueIds = Object.keys(DEFAULT_TOURNAMENT_BY_LEAGUE_ID).map(Number)
    const { data: leaguesRaw, error: leaguesErr } = await supabaseAdmin
      .from('leagues')
      .select('id, name, bold_phase_id')
      .in('id', leagueIds)
    if (leaguesErr) {
      const { data: fallback } = await supabaseAdmin
        .from('leagues')
        .select('id, name')
        .in('id', leagueIds)
      leaguesData = (fallback ?? []).map((l) => ({ ...l, bold_phase_id: null }))
    } else {
      leaguesData = leaguesRaw as typeof leaguesData
    }

    const phaseByLeague = new Map(
      (leaguesData ?? []).map((l) => [l.id, l.bold_phase_id ?? null])
    )

    const groupMap = new Map<
      number,
      {
        league_id: number
        league_name: string
        country: string
        default_tournament_id: number
        teams: Array<{
          bb_team_id: number
          bb_team_name: string
          bold_team_id: number | null
          bold_tournament_id: number | null
        }>
      }
    >()

    for (const r of rows ?? []) {
      const league = r.league as { id: number; name: string; country?: string } | null
      const leagueId = r.bb_league_id as number
      const leagueName = league?.name ?? '—'
      const country = league?.country ?? '—'
      const defaultTournamentId = DEFAULT_TOURNAMENT_BY_LEAGUE_ID[leagueId] ?? 0

      if (!groupMap.has(leagueId)) {
        groupMap.set(leagueId, {
          league_id: leagueId,
          league_name: leagueName,
          country,
          default_tournament_id: defaultTournamentId,
          teams: [],
        })
      }

      groupMap.get(leagueId)!.teams.push({
        bb_team_id: r.bb_team_id as number,
        bb_team_name: r.bb_team_name as string,
        bold_team_id: r.bold_team_id as number | null,
        bold_tournament_id: r.bold_tournament_id as number | null,
      })
    }

    const groups = [...groupMap.values()].sort((a, b) =>
      a.league_name.localeCompare(b.league_name)
    )

    const leagues = (leaguesData ?? [])
      .filter((l) => DEFAULT_TOURNAMENT_BY_LEAGUE_ID[l.id])
      .map((l) => ({
        id: l.id,
        name: l.name,
        bold_tournament_id: DEFAULT_TOURNAMENT_BY_LEAGUE_ID[l.id],
        bold_phase_id: phaseByLeague.get(l.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ leagues, groups })
  } catch (err) {
    console.error('[admin/team-xref] GET', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ukendt fejl' },
      { status: 500 }
    )
  }
}
