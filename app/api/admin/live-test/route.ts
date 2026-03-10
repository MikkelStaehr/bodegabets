import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const since = new Date()
    since.setHours(since.getHours() - 1)

    const [
      { data: liveMatchesData },
      { data: allLeagueMatches },
      { data: leaguesData },
      { data: recentData },
      { data: mappedTeams },
    ] = await Promise.all([
      supabaseAdmin
        .from('league_matches')
        .select(`
          id,
          league_id,
          home_team,
          away_team,
          home_score,
          away_score,
          status,
          bold_match_id,
          kickoff_at,
          updated_at,
          league:leagues ( name )
        `)
        .in('status', ['live', 'halftime'])
        .order('kickoff_at', { ascending: true }),

      supabaseAdmin
        .from('league_matches')
        .select('id, league_id, home_team, away_team'),

      supabaseAdmin
        .from('leagues')
        .select('id, name'),

      supabaseAdmin
        .from('league_matches')
        .select('bold_match_id, home_team, away_team, home_score, away_score, updated_at')
        .gte('updated_at', since.toISOString())
        .not('home_score', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5),

      supabaseAdmin
        .from('team_xref')
        .select('bb_league_id, bb_team_name')
        .not('bold_team_id', 'is', null),
    ])

    const mappedSet = new Set<string>()
    for (const t of mappedTeams ?? []) {
      mappedSet.add(`${(t as { bb_league_id: number }).bb_league_id}:${(t as { bb_team_name: string }).bb_team_name}`)
    }

    const byLeague = new Map<number, { total: number; matched: number }>()
    for (const m of allLeagueMatches ?? []) {
      const row = m as { id: number; league_id: number; home_team: string; away_team: string }
      const cur = byLeague.get(row.league_id) ?? { total: 0, matched: 0 }
      cur.total++
      const homeMapped = mappedSet.has(`${row.league_id}:${row.home_team}`)
      const awayMapped = mappedSet.has(`${row.league_id}:${row.away_team}`)
      if (homeMapped && awayMapped) cur.matched++
      byLeague.set(row.league_id, cur)
    }
    const leagueMap = new Map((leaguesData ?? []).map((l: { id: number; name: string }) => [l.id, l.name]))
    const coverage = [...byLeague.entries()]
      .map(([league_id, counts]) => ({
        league_id,
        name: leagueMap.get(league_id) ?? '—',
        total: counts.total,
        matched: counts.matched,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const liveMatches = (liveMatchesData ?? []).map((m: Record<string, unknown>) => {
      const league = m.league as { name?: string } | null
      return {
        id: m.id,
        league_id: m.league_id,
        league_name: league?.name ?? '—',
        home_team: m.home_team,
        away_team: m.away_team,
        home_score: m.home_score,
        away_score: m.away_score,
        status: m.status,
        bold_match_id: m.bold_match_id,
        kickoff_at: m.kickoff_at,
        updated_at: m.updated_at,
      }
    })

    return NextResponse.json({
      liveMatches,
      coverage,
      recentSyncs: recentData ?? [],
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[admin/live-test]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ukendt fejl' },
      { status: 500 }
    )
  }
}
