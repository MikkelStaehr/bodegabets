import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin.rpc('get_global_leaderboard')

  if (error) {
    // Fallback to raw query if RPC doesn't exist
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from('profiles')
      .select('id, username')

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 })
    }

    // Build leaderboard manually
    const userIds = fallback.map((p) => p.id)

    const [betsResult, membersResult] = await Promise.all([
      supabaseAdmin
        .from('bets')
        .select('user_id, id, bet_type, prediction, match_id, matches!inner(status, result)')
        .eq('bet_type', 'match_result')
        .in('user_id', userIds),
      supabaseAdmin
        .from('game_members')
        .select('user_id, earnings')
        .in('user_id', userIds),
    ])

    const bets = (betsResult.data ?? []) as unknown as {
      user_id: string
      id: number
      bet_type: string
      prediction: string
      match_id: number
      matches: { status: string; result: string | null }
    }[]

    const members = membersResult.data ?? []

    // Aggregate per user
    const statsMap = new Map<string, { total_bets: number; correct_bets: number; total_earnings: number }>()

    for (const b of bets) {
      if (!statsMap.has(b.user_id)) {
        statsMap.set(b.user_id, { total_bets: 0, correct_bets: 0, total_earnings: 0 })
      }
      const s = statsMap.get(b.user_id)!
      s.total_bets++
      if (b.matches.status === 'finished' && b.prediction === b.matches.result) {
        s.correct_bets++
      }
    }

    // Add earnings from game_members (use distinct game_member rows)
    const earningsSeen = new Set<string>()
    for (const gm of members) {
      const key = `${gm.user_id}`
      if (!earningsSeen.has(key)) {
        earningsSeen.add(key)
        if (statsMap.has(gm.user_id)) {
          statsMap.get(gm.user_id)!.total_earnings += (gm.earnings ?? 0)
        }
      }
    }

    const leaderboard = fallback
      .filter((p) => statsMap.has(p.id) && statsMap.get(p.id)!.total_bets > 0)
      .map((p) => {
        const s = statsMap.get(p.id)!
        return {
          username: p.username,
          total_bets: s.total_bets,
          correct_bets: s.correct_bets,
          correct_pct: s.total_bets > 0 ? Math.round((s.correct_bets / s.total_bets) * 100) : 0,
          total_earnings: s.total_earnings,
        }
      })
      .sort((a, b) => {
        const pctDiff = b.correct_pct - a.correct_pct
        if (pctDiff !== 0) return pctDiff
        return b.total_earnings - a.total_earnings
      })
      .slice(0, 10)

    return NextResponse.json(leaderboard)
  }

  return NextResponse.json(data)
}
