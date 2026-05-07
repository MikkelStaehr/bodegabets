import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  // Get featured season IDs
  const { data: featuredSeasons } = await supabaseAdmin
    .from('seasons')
    .select('id, tournaments!inner(name, logo_url, is_featured)')
    .eq('tournaments.is_featured', true)

  const featuredSeasonIds = (featuredSeasons ?? []).map((s) => s.id)
  if (featuredSeasonIds.length === 0) return NextResponse.json({ today: [], yesterday: [] })

  const { data: featuredRounds } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .in('season_id', featuredSeasonIds)

  const roundIds = (featuredRounds ?? []).map((r) => r.id)
  if (roundIds.length === 0) return NextResponse.json({ today: [], yesterday: [] })

  // Date boundaries (UTC)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)

  const matchSelect = `id, kickoff_at:kickoff, status, home_score, away_score,
    home_team:teams!home_team_id(short_name, logo_url),
    away_team:teams!away_team_id(short_name, logo_url),
    round:rounds!round_id(
      season:seasons!season_id(
        tournament:tournaments!tournament_id(name, logo_url)
      )
    )`

  const [todayResult, yesterdayResult] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select(matchSelect)
      .in('round_id', roundIds)
      .gte('kickoff', todayStart.toISOString())
      .lte('kickoff', todayEnd.toISOString())
      .order('kickoff', { ascending: true }),
    supabaseAdmin
      .from('matches')
      .select(matchSelect)
      .in('round_id', roundIds)
      .gte('kickoff', yesterdayStart.toISOString())
      .lt('kickoff', todayStart.toISOString())
      .eq('status', 'finished')
      .order('kickoff', { ascending: true }),
  ])

  return NextResponse.json({
    today: todayResult.data ?? [],
    yesterday: yesterdayResult.data ?? [],
  })
}
