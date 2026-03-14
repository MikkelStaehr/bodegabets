import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const since = new Date()
    since.setHours(since.getHours() - 1)

    const [
      { data: liveMatchesData },
      { data: recentData },
    ] = await Promise.all([
      supabaseAdmin
        .from('matches')
        .select(`
          id, season_id, home_team_id, away_team_id,
          home_score, away_score, status, bold_match_id,
          kickoff_at, updated_at,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name)
        `)
        .in('status', ['live', 'halftime'])
        .order('kickoff_at', { ascending: true }),

      supabaseAdmin
        .from('matches')
        .select(`
          bold_match_id, home_score, away_score, updated_at,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name)
        `)
        .gte('updated_at', since.toISOString())
        .not('home_score', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

    const seasonIds = [...new Set((liveMatchesData ?? []).map((m) => (m as { season_id: number }).season_id))]
    const { data: seasonRows } = seasonIds.length
      ? await supabaseAdmin
          .from('seasons')
          .select('id, tournament_id, tournaments(name)')
          .in('id', seasonIds)
      : { data: [] }

    const leagueNameBySeason = new Map<number, string>()
    const tournamentIdBySeason = new Map<number, number>()
    for (const s of seasonRows ?? []) {
      const t = (s as { tournaments?: { name?: string } | { name?: string }[] }).tournaments
      leagueNameBySeason.set(s.id as number, (Array.isArray(t) ? t[0] : t)?.name ?? '—')
      tournamentIdBySeason.set(s.id as number, (s as { tournament_id: number }).tournament_id)
    }

    const liveMatches = (liveMatchesData ?? []).map((m: Record<string, unknown>) => {
      const ht = m.home_team as { name?: string } | { name?: string }[] | null
      const at = m.away_team as { name?: string } | { name?: string }[] | null
      const sid = m.season_id as number
      return {
        id: m.id,
        league_id: tournamentIdBySeason.get(sid) ?? 0,
        league_name: leagueNameBySeason.get(sid) ?? '—',
        home_team: (Array.isArray(ht) ? ht[0] : ht)?.name ?? '—',
        away_team: (Array.isArray(at) ? at[0] : at)?.name ?? '—',
        home_score: m.home_score,
        away_score: m.away_score,
        status: m.status,
        bold_match_id: m.bold_match_id,
        kickoff_at: m.kickoff_at,
        updated_at: m.updated_at,
      }
    })

    const recentSyncs = (recentData ?? []).map((m: Record<string, unknown>) => {
      const ht = m.home_team as { name?: string } | { name?: string }[] | null
      const at = m.away_team as { name?: string } | { name?: string }[] | null
      return {
        bold_match_id: m.bold_match_id,
        home_team: (Array.isArray(ht) ? ht[0] : ht)?.name ?? '—',
        away_team: (Array.isArray(at) ? at[0] : at)?.name ?? '—',
        home_score: m.home_score,
        away_score: m.away_score,
        updated_at: m.updated_at,
      }
    })

    return NextResponse.json({
      liveMatches,
      coverage: [],
      recentSyncs,
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
