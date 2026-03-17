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
          id,
          season_id,
          bold_match_id,
          home_score,
          away_score,
          status,
          kickoff,
          updated_at,
          home_team:teams!home_team_id(id, name),
          away_team:teams!away_team_id(id, name)
        `)
        .in('status', ['live', 'halftime'])
        .order('kickoff', { ascending: true }),

      supabaseAdmin
        .from('matches')
        .select(`
          bold_match_id,
          home_score,
          away_score,
          updated_at,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name)
        `)
        .gte('updated_at', since.toISOString())
        .not('home_score', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

    const liveMatches = (liveMatchesData ?? []).map((m: Record<string, unknown>) => {
      const home = m.home_team as { id?: number; name?: string } | null
      const away = m.away_team as { id?: number; name?: string } | null
      return {
        id: m.id,
        season_id: m.season_id,
        home_team: home?.name ?? '—',
        away_team: away?.name ?? '—',
        home_score: m.home_score,
        away_score: m.away_score,
        status: m.status,
        bold_match_id: m.bold_match_id,
        kickoff: m.kickoff,
        updated_at: m.updated_at,
      }
    })

    const recentSyncs = (recentData ?? []).map((m: Record<string, unknown>) => {
      const home = m.home_team as { name?: string } | null
      const away = m.away_team as { name?: string } | null
      return {
        bold_match_id: m.bold_match_id,
        home_team: home?.name ?? '—',
        away_team: away?.name ?? '—',
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
