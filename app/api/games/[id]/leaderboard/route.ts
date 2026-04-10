import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

type LeaderboardEntry = {
  user_id: string
  username: string
  avatar_url: string | null
  round_wins: number
  round_points: number
  block_wins: number
  block_points: number
}

/**
 * GET /api/games/[id]/leaderboard
 *
 * Unified leaderboard for both football and cycling.
 * Returns: position, username, round wins/points, block wins/points
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id: gameId } = await params
  const numericGameId = Number(gameId)

  // Auth
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', numericGameId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  // Determine sport
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('sport')
    .eq('id', numericGameId)
    .single()

  if (!game) return NextResponse.json({ error: 'Spil ikke fundet' }, { status: 404 })

  const sport = game.sport ?? 'football'

  // Get all members
  const { data: members } = await supabaseAdmin
    .from('game_members')
    .select('user_id, profiles!inner(username, avatar_url)')
    .eq('game_id', numericGameId)

  if (!members?.length) return NextResponse.json({ leaderboard: [] })

  if (sport === 'cycling') {
    return NextResponse.json(await buildCyclingLeaderboard(numericGameId, members))
  } else {
    return NextResponse.json(await buildFootballLeaderboard(numericGameId, members))
  }
}

// ─── Football ──────────────────────────────────────────────────────────────

async function buildFootballLeaderboard(
  gameId: number,
  members: { user_id: string; profiles: unknown }[],
) {
  // Get season IDs for this game
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map((gs) => gs.season_id as number)
  if (seasonIds.length === 0) return { leaderboard: [] }

  // Get all rounds and blocks for these seasons
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, block_id, status')
    .in('season_id', seasonIds)

  const roundIds = (rounds ?? []).map((r) => r.id as number)
  if (roundIds.length === 0) return { leaderboard: [] }

  // Get all round_scores for this game
  const { data: scores } = await supabaseAdmin
    .from('round_scores')
    .select('user_id, round_id, earnings_delta')
    .eq('game_id', gameId)
    .in('round_id', roundIds)

  // Build round → block mapping
  const roundToBlock = new Map<number, number>()
  for (const r of rounds ?? []) {
    if (r.block_id) roundToBlock.set(r.id, r.block_id)
  }

  // Get finished round IDs
  const finishedRoundIds = new Set(
    (rounds ?? []).filter((r) => r.status === 'finished').map((r) => r.id)
  )

  // Aggregate per user
  type UserData = {
    roundPoints: Map<number, number>  // round_id → points
    blockPoints: Map<number, number>  // block_id → points
  }

  const userData = new Map<string, UserData>()
  for (const m of members) {
    userData.set(m.user_id, { roundPoints: new Map(), blockPoints: new Map() })
  }

  for (const s of scores ?? []) {
    const ud = userData.get(s.user_id)
    if (!ud) continue
    const pts = Number(s.earnings_delta) || 0
    ud.roundPoints.set(s.round_id, (ud.roundPoints.get(s.round_id) ?? 0) + pts)

    const blockId = roundToBlock.get(s.round_id)
    if (blockId) {
      ud.blockPoints.set(blockId, (ud.blockPoints.get(blockId) ?? 0) + pts)
    }
  }

  // Calculate round wins (only finished rounds)
  const roundWins = countWins(userData, 'roundPoints', finishedRoundIds)

  // Calculate block wins
  const blockIds = new Set<number>()
  for (const r of rounds ?? []) { if (r.block_id) blockIds.add(r.block_id) }
  const blockWins = countWins(userData, 'blockPoints', blockIds)

  return { leaderboard: buildEntries(members, userData, roundWins, blockWins) }
}

// ─── Cycling ───────────────────────────────────────────────────────────────

async function buildCyclingLeaderboard(
  gameId: number,
  members: { user_id: string; profiles: unknown }[],
) {
  // Get all scores with lineup → squad → user mapping
  const { data: scores } = await supabaseAdmin
    .from('cycling_scores')
    .select('stage_id, race_id, total_points, cycling_lineups!inner(squad_id, cycling_squads!inner(user_id, game_id))')
    .eq('cycling_lineups.cycling_squads.game_id', gameId)

  // Get race → block mapping
  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id, cycling_block_id')
    .eq('game_id', gameId)

  const raceToBlock = new Map<string, string>()
  for (const gr of gameRaces ?? []) {
    if (gr.cycling_block_id) raceToBlock.set(gr.race_id, gr.cycling_block_id)
  }

  // Aggregate per user
  type UserData = {
    roundPoints: Map<string, number>  // stage_id → points
    blockPoints: Map<string, number>  // block_id → points
  }

  const userData = new Map<string, UserData>()
  for (const m of members) {
    userData.set(m.user_id, { roundPoints: new Map(), blockPoints: new Map() })
  }

  for (const s of scores ?? []) {
    const lineup = s.cycling_lineups as unknown as { squad_id: string; cycling_squads: { user_id: string } }
    const userId = lineup?.cycling_squads?.user_id
    if (!userId) continue

    const ud = userData.get(userId)
    if (!ud) continue

    const pts = Number(s.total_points) || 0
    const stageId = s.stage_id as string
    ud.roundPoints.set(stageId, (ud.roundPoints.get(stageId) ?? 0) + pts)

    const blockId = raceToBlock.get(s.race_id as string)
    if (blockId) {
      ud.blockPoints.set(blockId, (ud.blockPoints.get(blockId) ?? 0) + pts)
    }
  }

  // All stage IDs and block IDs as "finished" (cycling doesn't have per-stage status yet)
  const stageIds = new Set<string>()
  for (const ud of userData.values()) {
    for (const sid of ud.roundPoints.keys()) stageIds.add(sid)
  }
  const blockIds = new Set<string>()
  for (const ud of userData.values()) {
    for (const bid of ud.blockPoints.keys()) blockIds.add(bid)
  }

  const roundWins = countWins(userData, 'roundPoints', stageIds)
  const blockWins = countWins(userData, 'blockPoints', blockIds)

  return { leaderboard: buildEntries(members, userData, roundWins, blockWins) }
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function countWins<K>(
  userData: Map<string, { roundPoints: Map<K, number>; blockPoints: Map<K, number> }>,
  field: 'roundPoints' | 'blockPoints',
  ids: Set<K>,
): Map<string, number> {
  const wins = new Map<string, number>()
  for (const id of ids) {
    let maxPts = -Infinity
    let winnerId: string | null = null
    for (const [uid, ud] of userData) {
      const pts = ud[field].get(id) ?? 0
      if (pts > maxPts) { maxPts = pts; winnerId = uid }
    }
    if (winnerId && maxPts > 0) {
      wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1)
    }
  }
  return wins
}

function buildEntries(
  members: { user_id: string; profiles: unknown }[],
  userData: Map<string, { roundPoints: Map<unknown, number>; blockPoints: Map<unknown, number> }>,
  roundWins: Map<string, number>,
  blockWins: Map<string, number>,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = members.map((m) => {
    const profile = m.profiles as { username: string; avatar_url: string | null }
    const ud = userData.get(m.user_id)

    let totalRoundPoints = 0
    if (ud) for (const pts of ud.roundPoints.values()) totalRoundPoints += pts

    let totalBlockPoints = 0
    if (ud) for (const pts of ud.blockPoints.values()) totalBlockPoints += pts

    return {
      user_id: m.user_id,
      username: profile?.username ?? 'Anonym',
      avatar_url: profile?.avatar_url ?? null,
      round_wins: roundWins.get(m.user_id) ?? 0,
      round_points: Math.round(totalRoundPoints * 10) / 10,
      block_wins: blockWins.get(m.user_id) ?? 0,
      block_points: Math.round(totalBlockPoints * 10) / 10,
    }
  })

  entries.sort((a, b) => b.block_points - a.block_points || b.round_points - a.round_points)
  return entries
}
