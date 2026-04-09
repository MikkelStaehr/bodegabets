import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

/**
 * GET /api/cycling-games/[id]/leaderboard
 *
 * Returns leaderboard with:
 * - position, user_id, username
 * - Per-stage points (runde_points) and wins (runde_wins)
 * - Per-block totals (block_points, block_wins)
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id: gameId } = await params
  const numericGameId = Number(gameId)

  // 1. Get all game members
  const { data: members } = await supabaseAdmin
    .from('game_members')
    .select('user_id, profiles!inner(username, avatar_url)')
    .eq('game_id', numericGameId)

  if (!members?.length) return NextResponse.json({ leaderboard: [] })

  // 2. Get all scores for this game
  const { data: scores } = await supabaseAdmin
    .from('cycling_scores')
    .select('lineup_id, rider_id, stage_id, race_id, total_points, cycling_lineups!inner(squad_id, cycling_squads!inner(user_id, game_id))')
    .eq('cycling_lineups.cycling_squads.game_id', numericGameId)

  // 3. Get blocks and race mappings
  const { data: blocks } = await supabaseAdmin
    .from('cycling_blocks')
    .select('id, name, block_order')
    .eq('game_id', numericGameId)
    .order('block_order')

  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id, cycling_block_id')
    .eq('game_id', numericGameId)

  // Map race_id → block_id
  const raceToBlock = new Map<string, string>()
  for (const gr of gameRaces ?? []) {
    if (gr.cycling_block_id) raceToBlock.set(gr.race_id, gr.cycling_block_id)
  }

  // 4. Aggregate scores per user per stage and per block
  type UserScore = {
    user_id: string
    username: string
    avatar_url: string | null
    stage_points: Map<string, number> // stage_id → total
    block_points: Map<string, number> // block_id → total
  }

  const userScores = new Map<string, UserScore>()

  // Initialize all members
  for (const m of members) {
    const profile = m.profiles as unknown as { username: string; avatar_url: string | null }
    userScores.set(m.user_id, {
      user_id: m.user_id,
      username: profile.username ?? 'Anonym',
      avatar_url: profile.avatar_url ?? null,
      stage_points: new Map(),
      block_points: new Map(),
    })
  }

  // Sum scores
  for (const s of scores ?? []) {
    const lineup = s.cycling_lineups as unknown as { squad_id: string; cycling_squads: { user_id: string; game_id: number } }
    const userId = lineup?.cycling_squads?.user_id
    if (!userId) continue

    const user = userScores.get(userId)
    if (!user) continue

    const pts = Number(s.total_points) || 0
    const stageId = s.stage_id as string
    const raceId = s.race_id as string

    // Stage points
    user.stage_points.set(stageId, (user.stage_points.get(stageId) ?? 0) + pts)

    // Block points
    const blockId = raceToBlock.get(raceId)
    if (blockId) {
      user.block_points.set(blockId, (user.block_points.get(blockId) ?? 0) + pts)
    }
  }

  // 5. Determine stage winners and block winners
  const stageIds = new Set<string>()
  for (const u of userScores.values()) {
    for (const sid of u.stage_points.keys()) stageIds.add(sid)
  }

  // Stage wins
  const stageWins = new Map<string, number>() // user_id → win count
  for (const stageId of stageIds) {
    let maxPts = -Infinity
    let winnerId: string | null = null
    for (const [uid, u] of userScores) {
      const pts = u.stage_points.get(stageId) ?? 0
      if (pts > maxPts) { maxPts = pts; winnerId = uid }
    }
    if (winnerId && maxPts > 0) {
      stageWins.set(winnerId, (stageWins.get(winnerId) ?? 0) + 1)
    }
  }

  // Block wins
  const blockWins = new Map<string, number>()
  for (const block of blocks ?? []) {
    let maxPts = -Infinity
    let winnerId: string | null = null
    for (const [uid, u] of userScores) {
      const pts = u.block_points.get(block.id) ?? 0
      if (pts > maxPts) { maxPts = pts; winnerId = uid }
    }
    if (winnerId && maxPts > 0) {
      blockWins.set(winnerId, (blockWins.get(winnerId) ?? 0) + 1)
    }
  }

  // 6. Build leaderboard sorted by total points
  const leaderboard = [...userScores.values()].map((u) => {
    let totalStagePoints = 0
    for (const pts of u.stage_points.values()) totalStagePoints += pts

    let totalBlockPoints = 0
    for (const pts of u.block_points.values()) totalBlockPoints += pts

    return {
      user_id: u.user_id,
      username: u.username,
      avatar_url: u.avatar_url,
      stage_wins: stageWins.get(u.user_id) ?? 0,
      stage_points: Math.round(totalStagePoints * 10) / 10,
      block_wins: blockWins.get(u.user_id) ?? 0,
      block_points: Math.round(totalBlockPoints * 10) / 10,
    }
  })

  // Sort by block_points desc, then stage_points desc
  leaderboard.sort((a, b) => b.block_points - a.block_points || b.stage_points - a.stage_points)

  return NextResponse.json({ leaderboard })
}
