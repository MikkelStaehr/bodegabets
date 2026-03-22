import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) return NextResponse.json({ error: 'Ugyldigt game_id' }, { status: 400 })

  // Tjek at bruger er game_member
  const { data: member } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  // Hent alle låste kampe i dette spil
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)

  const seasonIds = (gameSeasons ?? []).map(gs => gs.season_id as number)
  if (!seasonIds.length) return NextResponse.json({ distribution: {} })

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .in('season_id', seasonIds)

  const roundIds = (rounds ?? []).map(r => r.id as number)
  if (!roundIds.length) return NextResponse.json({ distribution: {} })

  // Hent kun låste kampe (bet_open = false)
  const { data: lockedMatches } = await supabaseAdmin
    .from('matches')
    .select('id')
    .in('round_id', roundIds)
    .eq('bet_open', false)

  const lockedMatchIds = (lockedMatches ?? []).map(m => m.id as number)
  if (!lockedMatchIds.length) return NextResponse.json({ distribution: {} })

  // Hent bet fordeling
  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('match_id, prediction')
    .eq('game_id', gameId)
    .eq('bet_type', 'match_result')
    .in('match_id', lockedMatchIds)

  // Byg fordeling map
  const distribution: Record<number, { '1': number; 'X': number; '2': number; total: number }> = {}

  for (const bet of bets ?? []) {
    if (!distribution[bet.match_id]) {
      distribution[bet.match_id] = { '1': 0, 'X': 0, '2': 0, total: 0 }
    }
    if (bet.prediction === '1' || bet.prediction === 'X' || bet.prediction === '2') {
      distribution[bet.match_id][bet.prediction]++
      distribution[bet.match_id].total++
    }
  }

  return NextResponse.json({ distribution })
}
