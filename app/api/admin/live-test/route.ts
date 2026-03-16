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
        .select('bold_match_id, home_team, away_team, home_score, away_score, updated_at')
        .gte('updated_at', since.toISOString())
        .not('home_score', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

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
      coverage: [],
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
