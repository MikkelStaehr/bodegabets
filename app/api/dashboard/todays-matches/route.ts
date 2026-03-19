import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)

  const [todayResult, yesterdayResult] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select(`id, kickoff_at:kickoff, status, home_score, away_score,
        home_team:teams!home_team_id(name, short_name, logo_url),
        away_team:teams!away_team_id(name, short_name, logo_url)`)
      .gte('kickoff', todayStart.toISOString())
      .lte('kickoff', todayEnd.toISOString())
      .order('kickoff', { ascending: true }),
    supabaseAdmin
      .from('matches')
      .select(`id, kickoff_at:kickoff, status, home_score, away_score,
        home_team:teams!home_team_id(name, short_name, logo_url),
        away_team:teams!away_team_id(name, short_name, logo_url)`)
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
