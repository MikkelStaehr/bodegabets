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

  // Hent runden med season_id
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('id, name, season_id')
    .eq('id', roundId)
    .single()

  if (!round) return NextResponse.json({ error: 'Runde ikke fundet' }, { status: 404 })

  // Tjek membership via game_seasons
  const { data: userGameIds } = await supabaseAdmin
    .from('game_members')
    .select('game_id')
    .eq('user_id', user.id)

  const memberGameIds = (userGameIds ?? []).map((g: { game_id: number }) => g.game_id)

  let membership = null
  if (memberGameIds.length > 0) {
    const { data: match } = await supabaseAdmin
      .from('game_seasons')
      .select('game_id')
      .eq('season_id', round.season_id)
      .in('game_id', memberGameIds)
      .limit(1)
      .maybeSingle()
    membership = match
  }
  if (!membership) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const since = new Date()
  since.setHours(since.getHours() - 24)

  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, home_score_ht, away_score_ht, status, kickoff_at')
    .eq('round_id', roundId)
    .in('status', ['live', 'halftime', 'finished'])
    .gte('kickoff_at', since.toISOString())
    .order('kickoff_at', { ascending: true })
    .limit(50)

  // Filtrér fremtidige kampe — status live/finished kræver kickoff i fortiden
  const nowIso = new Date().toISOString()
  const matchList = (matches ?? []).filter((m) => m.kickoff_at && m.kickoff_at <= nowIso)

  const live = matchList.filter((m) => m.status === 'live').length
  const halftime = matchList.filter((m) => m.status === 'halftime').length
  const finished = matchList.filter((m) => m.status === 'finished').length
  const total = matchList.length

  return NextResponse.json({
    matches: matchList,
    summary: { live, halftime, finished, total },
  })
}
