import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  // Get user's active game_ids → season_ids → round_ids
  const { data: memberships } = await supabaseAdmin
    .from('game_members')
    .select('game_id')
    .eq('user_id', user.id)

  const gameIds = [...new Set((memberships ?? []).map((m) => m.game_id))]
  if (gameIds.length === 0) return NextResponse.json({ today: [], yesterday: [] })

  const { data: activeGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .in('id', gameIds)
    .eq('status', 'active')

  const activeGameIds = (activeGames ?? []).map((g) => g.id)
  if (activeGameIds.length === 0) return NextResponse.json({ today: [], yesterday: [] })

  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .in('game_id', activeGameIds)

  const seasonIds = [...new Set((gameSeasons ?? []).map((gs) => gs.season_id))]
  if (seasonIds.length === 0) return NextResponse.json({ today: [], yesterday: [] })

  // Get non-finished round_ids for these seasons
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .in('season_id', seasonIds)
    .neq('status', 'finished')

  const roundIds = (rounds ?? []).map((r) => r.id)
  if (roundIds.length === 0) return NextResponse.json({ today: [], yesterday: [] })

  // Date boundaries (UTC)
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)

  // Today's matches
  const { data: todayMatches } = await supabaseAdmin
    .from('matches')
    .select(`id, kickoff, status, home_score, away_score,
      home_team:teams!home_team_id(name, shortname, logo_url),
      away_team:teams!away_team_id(name, shortname, logo_url)`)
    .in('round_id', roundIds)
    .gte('kickoff', todayStart.toISOString())
    .lt('kickoff', tomorrowStart.toISOString())
    .order('kickoff', { ascending: true })

  // Yesterday's finished matches
  const { data: yesterdayMatches } = await supabaseAdmin
    .from('matches')
    .select(`id, kickoff, status, home_score, away_score,
      home_team:teams!home_team_id(name, shortname, logo_url),
      away_team:teams!away_team_id(name, shortname, logo_url)`)
    .in('round_id', roundIds)
    .gte('kickoff', yesterdayStart.toISOString())
    .lt('kickoff', todayStart.toISOString())
    .eq('status', 'finished')
    .order('kickoff', { ascending: true })

  return NextResponse.json({
    today: todayMatches ?? [],
    yesterday: yesterdayMatches ?? [],
  })
}
