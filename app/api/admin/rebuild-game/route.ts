import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { buildLeagueRounds } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { game_id } = await req.json() as { game_id: number }
  if (!game_id) return NextResponse.json({ error: 'game_id mangler' }, { status: 400 })

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name')
    .eq('id', game_id)
    .single()

  if (!game) {
    return NextResponse.json({ error: 'Spilrum ikke fundet' }, { status: 404 })
  }

  // Hent league_id via game_leagues junction table
  const { data: gameLeague } = await supabaseAdmin
    .from('game_leagues')
    .select('league_id')
    .eq('game_id', game_id)
    .limit(1)
    .single()

  if (!gameLeague?.league_id) {
    return NextResponse.json({ error: 'Liga ikke fundet for spilrum' }, { status: 404 })
  }

  const leagueId = gameLeague.league_id
  const result = await buildLeagueRounds(leagueId)

  // Hvis ingen matches blev oprettet, hent diagnostic
  let diagnostic: { league_matches_count?: number; rounds_count?: number } | null = null
  if (result.matches_created === 0 && result.matches_updated === 0) {
    const [lmRes, rRes] = await Promise.all([
      supabaseAdmin.from('league_matches').select('*', { count: 'exact', head: true }).eq('league_id', leagueId),
      supabaseAdmin.from('rounds').select('*', { count: 'exact', head: true }).eq('league_id', leagueId),
    ])
    diagnostic = {
      league_matches_count: lmRes.count ?? 0,
      rounds_count: rRes.count ?? 0,
    }
  }

  return NextResponse.json({
    ok: true,
    game_id,
    game_name: game.name,
    ...result,
    diagnostic: diagnostic ?? undefined,
    debug: result.debug,
  })
}
