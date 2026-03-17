import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type Props = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) {
    return NextResponse.json({ error: 'Ugyldigt game_id' }, { status: 400 })
  }

  // Tjek membership
  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  // Hent alle season_ids for dette spil
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map((gs: { season_id: number }) => gs.season_id)
  if (seasonIds.length === 0) {
    return NextResponse.json({ matches: [], summary: { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 } })
  }

  const now = new Date()
  const since = new Date(now)
  since.setHours(since.getHours() - 24)
  const soonCutoff = new Date(now)
  soonCutoff.setMinutes(soonCutoff.getMinutes() + 60)

  // Hent live/halftime/finished kampe fra alle sæsoner (kickoff inden for 24 timer)
  const { data: activeMatches } = await supabaseAdmin
    .from('matches')
    .select(`id, home_score, away_score, home_score_ht, away_score_ht, status, kickoff,
      home_team_ref:teams!home_team_id(name, logo_url),
      away_team_ref:teams!away_team_id(name, logo_url)`)
    .in('season_id', seasonIds)
    .in('status', ['live', 'halftime', 'finished'])
    .gte('kickoff', since.toISOString())
    .order('kickoff', { ascending: true })
    .limit(100)

  // Hent scheduled kampe (kickoff inden for 60 min)
  const { data: scheduledMatches } = await supabaseAdmin
    .from('matches')
    .select(`id, home_score, away_score, home_score_ht, away_score_ht, status, kickoff,
      home_team_ref:teams!home_team_id(name, logo_url),
      away_team_ref:teams!away_team_id(name, logo_url)`)
    .in('season_id', seasonIds)
    .eq('status', 'scheduled')
    .gt('kickoff', now.toISOString())
    .lte('kickoff', soonCutoff.toISOString())
    .order('kickoff', { ascending: true })
    .limit(50)

  const nowIso = now.toISOString()

  const activeList = (activeMatches ?? [])
    .filter((m) => m.kickoff && m.kickoff <= nowIso)

  const allMatches = [...activeList, ...(scheduledMatches ?? [])]

  const matchList = allMatches.map((m) => {
    const homeRef = m.home_team_ref as unknown as { name: string; logo_url: string | null } | null
    const awayRef = m.away_team_ref as unknown as { name: string; logo_url: string | null } | null
    return {
      id: m.id,
      home_team: homeRef?.name ?? '',
      away_team: awayRef?.name ?? '',
      home_score: m.home_score,
      away_score: m.away_score,
      home_score_ht: m.home_score_ht,
      away_score_ht: m.away_score_ht,
      status: m.status,
      kickoff_at: m.kickoff,
      home_team_logo: homeRef?.logo_url ?? null,
      away_team_logo: awayRef?.logo_url ?? null,
    }
  })

  const live = matchList.filter((m) => m.status === 'live').length
  const halftime = matchList.filter((m) => m.status === 'halftime').length
  const finished = matchList.filter((m) => m.status === 'finished').length
  const scheduled = matchList.filter((m) => m.status === 'scheduled').length
  const total = matchList.length

  return NextResponse.json({
    matches: matchList,
    summary: { live, halftime, finished, scheduled, total },
  })
}
