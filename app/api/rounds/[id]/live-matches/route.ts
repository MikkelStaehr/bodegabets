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

  // Tjek at brugeren har adgang til runden (medlem af spillet)
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('game_id')
    .eq('id', roundId)
    .single()

  if (!round) return NextResponse.json({ error: 'Runde ikke fundet' }, { status: 404 })

  const { data: membershipRows } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', round.game_id)
    .eq('user_id', user.id)
    .limit(1)

  const membership = membershipRows?.[0] ?? null
  if (!membership) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const since = new Date()
  since.setHours(since.getHours() - 24)

  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, home_ht_score, away_ht_score, status, kickoff_at, bold_match_id')
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
