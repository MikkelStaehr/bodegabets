import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import type { BetType } from '@/types'

type BetInput = {
  match_id: number
  bet_type: BetType
  prediction: string
  stake: number
  potential_win: number
}

type RequestBody = {
  game_id: number
  round_id: number
  bets: BetInput[]
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const body: RequestBody = await req.json()
  const { game_id, round_id, bets } = body

  if (!game_id || !round_id || !Array.isArray(bets) || bets.length === 0) {
    return NextResponse.json({ error: 'Manglende data' }, { status: 400 })
  }

  // Tjek at runden er åben
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('status')
    .eq('id', round_id)
    .eq('game_id', game_id)
    .single()

  if (!round || round.status !== 'open') {
    return NextResponse.json({ error: 'Runden er ikke åben for bets' }, { status: 400 })
  }

  // Tjek at brugeren er game_member og hent lokale point
  const { data: member } = await supabaseAdmin
    .from('game_members')
    .select('points')
    .eq('game_id', game_id)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Du er ikke med i dette spil' }, { status: 403 })
  }

  // Validér at total indsats ikke overstiger lokale point
  const totalStake = bets.reduce((sum, b) => sum + (b.stake ?? 0), 0)
  if (totalStake > member.points) {
    return NextResponse.json(
      { error: `Ikke nok point. Du har ${member.points} pt, men bruger ${totalStake} pt.` },
      { status: 400 }
    )
  }

  // Validér at alle match_ids tilhører denne runde
  const matchIds = [...new Set(bets.map((b) => b.match_id))]
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id')
    .eq('round_id', round_id)
    .in('id', matchIds)

  if (!matches || matches.length !== matchIds.length) {
    return NextResponse.json({ error: 'Ugyldige kamp-id\'er' }, { status: 400 })
  }

  // Upsert alle bets
  const rows = bets.map((b) => ({
    user_id: user.id,
    match_id: b.match_id,
    game_id,
    bet_type: b.bet_type,
    prediction: b.prediction,
    stake: b.stake,
    potential_win: b.potential_win,
    result: 'pending' as const,
    points_delta: null,
  }))

  const { error: upsertError } = await supabaseAdmin
    .from('bets')
    .upsert(rows, { onConflict: 'user_id,match_id,bet_type' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: rows.length })
}
