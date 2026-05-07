/**
 * GET /api/live-scores?round_id=X
 * Henter live scores fra Bold API for alle kampe i en runde.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { getLiveScores } from '@/lib/getLiveScores'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const roundId = req.nextUrl.searchParams.get('round_id')
  if (!roundId) {
    return NextResponse.json({ error: 'round_id mangler' }, { status: 400 })
  }

  const roundIdNum = parseInt(roundId, 10)
  if (isNaN(roundIdNum)) {
    return NextResponse.json({ error: 'Ugyldig round_id' }, { status: 400 })
  }

  // Verificér at brugeren er medlem af mindst ét spil hvis season indeholder denne runde
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('season_id')
    .eq('id', roundIdNum)
    .maybeSingle()

  if (!round) return NextResponse.json({ error: 'Runde ikke fundet' }, { status: 404 })

  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('game_id')
    .eq('season_id', round.season_id)

  const gameIds = (gameSeasons ?? []).map((gs) => gs.game_id as number)
  if (gameIds.length === 0) {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })
  }

  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('game_id')
    .eq('user_id', user.id)
    .in('game_id', gameIds)
    .limit(1)

  if (!membership?.length) {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })
  }

  try {
    const results = await getLiveScores(roundIdNum)
    return NextResponse.json(results)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukendt fejl'
    console.error('[live-scores]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
