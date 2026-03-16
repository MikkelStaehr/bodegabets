/**
 * Client-venlig proxy til sync-league.
 * Bruger requireAdmin (session + is_admin eller Bearer token).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { syncLeagueViaBold } from '@/lib/syncLeagueMatches'
import { buildGameRounds } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { league_id, rebuild_rounds } = await req.json() as {
    league_id: number
    rebuild_rounds?: boolean
  }

  if (!league_id) {
    return NextResponse.json({ error: 'league_id er påkrævet' }, { status: 400 })
  }

  const syncRes = await syncLeagueViaBold(league_id)

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('leagues')
    .update({ last_synced_at: now })
    .eq('id', league_id)

  let rounds_created = 0, matches_created = 0, matches_updated = 0

  if (rebuild_rounds) {
    // Find seasons for this league, then find games via game_seasons
    const { data: seasonRows } = await supabaseAdmin
      .from('seasons')
      .select('id')
      .eq('tournament_id', league_id)
    const seasonIds = (seasonRows ?? []).map((s: { id: number }) => s.id)

    const { data: gameSeasonRows } = seasonIds.length
      ? await supabaseAdmin
          .from('game_seasons')
          .select('game_id')
          .in('season_id', seasonIds)
      : { data: [] as { game_id: number }[] }

    const gameIdsForLeague = (gameSeasonRows ?? []).map((g: { game_id: number }) => g.game_id)

    const { data: games } = gameIdsForLeague.length
      ? await supabaseAdmin
          .from('games')
          .select('id')
          .in('id', gameIdsForLeague)
          .eq('status', 'active')
      : { data: [] as { id: number }[] }

    for (const g of (games ?? []) as { id: number }[]) {
      const res = await buildGameRounds(g.id, league_id)
      rounds_created  += res.rounds_created
      matches_created += res.matches_created
      matches_updated += res.matches_updated
    }
  }

  return NextResponse.json({ ...syncRes, rounds_created, matches_created, matches_updated })
}
