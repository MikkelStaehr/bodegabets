import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateRoundPoints, syncProfilesPoints } from '@/lib/calculatePoints'
import { logAdmin } from '@/lib/adminLogs'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { round_id, game_id } = body as { round_id: number; game_id: number }

  if (!round_id || !game_id) {
    return NextResponse.json({ error: 'round_id og game_id er påkrævet' }, { status: 400 })
  }

  // Tjek at runden har færdige kampe
  const { data: matchRows } = await supabaseAdmin
    .from('matches')
    .select('id')
    .eq('round_id', round_id)
    .eq('status', 'finished')

  if (!matchRows?.length) {
    return NextResponse.json(
      { error: 'Ingen færdige kampe i denne runde endnu' },
      { status: 400 }
    )
  }

  // Brug calculatePoints (én pointberegning)
  await calculateRoundPoints(round_id)

  // Hent round_scores, game_members og profiles til response
  const [{ data: roundScores }, { data: memberRows }, { data: betRows }] = await Promise.all([
    supabaseAdmin
      .from('round_scores')
      .select('user_id, points_earned')
      .eq('round_id', round_id),

    supabaseAdmin
      .from('game_members')
      .select('user_id, points')
      .eq('game_id', game_id),

    supabaseAdmin
      .from('bets')
      .select('id')
      .eq('game_id', game_id)
      .in('match_id', matchRows.map((m) => m.id)),
  ])

  const scores = roundScores ?? []
  const userIds = [...new Set(scores.map((s: { user_id: string }) => s.user_id))]

  const { data: profileRows } = await supabaseAdmin
    .from('profiles')
    .select('id, username, points')
    .in('id', userIds)

  const memberMap = new Map(
    (memberRows ?? []).map((m: { user_id: string; points: number }) => [m.user_id, m.points])
  )
  const profileMap = new Map(
    (profileRows ?? []).map((p: { id: string; username: string; points: number }) => [
      p.id,
      { username: p.username, points: p.points },
    ])
  )

  // Synkroniser profiles.points med sum af game_members.points (kanonisk kilde)
  await syncProfilesPoints()

  const results = scores
    .map((s: { user_id: string; points_earned: number }) => ({
      username: profileMap.get(s.user_id)?.username ?? s.user_id,
      points_delta: s.points_earned ?? 0,
      new_total: memberMap.get(s.user_id) ?? 0,
    }))
    .sort((a, b) => b.points_delta - a.points_delta)

  await logAdmin('point_calc', 'success', `Runde ${round_id}: ${results.length} spillere opdateret`, {
    round_id,
    game_id,
    bets_evaluated: (betRows ?? []).length,
  })

  return NextResponse.json({
    ok: true,
    round_id,
    game_id,
    bets_evaluated: (betRows ?? []).length,
    results,
  })
}
