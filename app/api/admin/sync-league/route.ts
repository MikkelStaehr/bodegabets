import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncLeagueFixtures } from '@/lib/fixtureDownload'
import { buildGameRounds } from '@/lib/syncLeagueMatches'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json() as {
    league_id?: number
    leagueId?: number
    game_id?: number
    gameId?: number
    rebuild_rounds?: boolean
  }

  const league_id = body.league_id ?? body.leagueId
  const game_id = body.game_id ?? body.gameId

  if (!league_id) {
    return NextResponse.json({ error: 'league_id er påkrævet' }, { status: 400 })
  }

  let syncRes = { synced: 0, errors: [] as string[] }
  if (!game_id) {
    syncRes = await syncLeagueFixtures(league_id)
  }

  let rounds_created = 0, matches_created = 0, matches_updated = 0

  if (game_id) {
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('id, league_id')
      .eq('id', game_id)
      .single()
    if (!game || game.league_id !== league_id) {
      return NextResponse.json({ error: 'Spil ikke fundet eller liga matcher ikke' }, { status: 400 })
    }
    const res = await buildGameRounds(game.id, league_id)
    rounds_created = res.rounds_created
    matches_created = res.matches_created
    matches_updated = res.matches_updated
  } else if (body.rebuild_rounds) {
    const { data: games } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('league_id', league_id)
      .eq('status', 'active')

    for (const g of (games ?? []) as { id: number }[]) {
      const res = await buildGameRounds(g.id, league_id)
      rounds_created  += res.rounds_created
      matches_created += res.matches_created
      matches_updated += res.matches_updated
    }
  }

  return NextResponse.json({
    ...syncRes,
    rounds_created,
    matches_created,
    matches_updated,
  })
}
