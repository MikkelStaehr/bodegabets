import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type Props = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roundId = parseInt(id)
  if (isNaN(roundId)) {
    return NextResponse.json({ error: 'Ugyldigt round_id' }, { status: 400 })
  }

  // Tjek at brugeren har adgang til runden (medlem af et spilrum i sæsonen)
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('season_id')
    .eq('id', roundId)
    .single()

  if (!round) return NextResponse.json({ error: 'Runde ikke fundet' }, { status: 404 })

  // Find games i denne sæson via game_seasons og tjek om brugeren er medlem af mindst ét
  const { data: gameSeasonRows } = await supabaseAdmin
    .from('game_seasons')
    .select('game_id')
    .eq('season_id', round.season_id)
  const gameIds = (gameSeasonRows ?? []).map((g: { game_id: number }) => g.game_id)

  let membership = null
  if (gameIds.length > 0) {
    const { data: membershipRows } = await supabaseAdmin
      .from('game_members')
      .select('user_id')
      .in('game_id', gameIds)
      .eq('user_id', user.id)
      .limit(1)
    membership = membershipRows?.[0] ?? null
  }
  if (!membership) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const since = new Date()
  since.setHours(since.getHours() - 24)

  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select(`
      id, home_team_id, away_team_id,
      home_score, away_score, home_score_ht, away_score_ht,
      status, kickoff_at,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name)
    `)
    .eq('round_id', roundId)
    .in('status', ['live', 'halftime', 'finished'])
    .gte('kickoff_at', since.toISOString())
    .order('kickoff_at', { ascending: true })
    .limit(50)

  // Filtrér fremtidige kampe — status live/finished kræver kickoff i fortiden
  const nowIso = new Date().toISOString()
  const matchList = (matches ?? []).map((m) => {
    const ht = (m as { home_team?: { name?: string } | { name?: string }[] }).home_team
    const at = (m as { away_team?: { name?: string } | { name?: string }[] }).away_team
    return {
      ...m,
      home_team: (Array.isArray(ht) ? ht[0] : ht)?.name ?? '—',
      away_team: (Array.isArray(at) ? at[0] : at)?.name ?? '—',
    }
  }).filter((m) => m.kickoff_at && m.kickoff_at <= nowIso)

  const live = matchList.filter((m) => m.status === 'live').length
  const halftime = matchList.filter((m) => m.status === 'halftime').length
  const finished = matchList.filter((m) => m.status === 'finished').length
  const total = matchList.length

  return NextResponse.json({
    matches: matchList,
    summary: { live, halftime, finished, total },
  })
}
