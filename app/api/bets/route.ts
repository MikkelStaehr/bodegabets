import { NextRequest, NextResponse } from 'next/server'
import { betsLimiter } from '@/lib/rateLimit'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { predictionToScores } from '@/lib/betScores'

type BetInput = {
  match_id: number
  bet_type: string
  prediction: string
  stake: number
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

  const limit = betsLimiter(user.id)
  if (!limit.ok) {
    return NextResponse.json({ error: 'For mange forsøg — prøv igen om lidt' }, { status: 429 })
  }

  const body: RequestBody = await req.json()
  const { game_id, round_id, bets } = body

  if (!game_id || !round_id || !Array.isArray(bets) || bets.length === 0) {
    return NextResponse.json({ error: 'Manglende data' }, { status: 400 })
  }

  // Tjek at runden er åben
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('status, season_id, name')
    .eq('id', round_id)
    .single()

  if (!round || round.status !== 'open') {
    return NextResponse.json({ error: 'Runden er ikke åben for bets' }, { status: 400 })
  }

  // Tjek at brugeren er game_member
  const { data: member } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', game_id)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Du er ikke med i dette spil' }, { status: 403 })
  }

  // Validér at alle match_ids tilhører denne runde (matches har season_id + round_name)
  const matchIds = [...new Set(bets.map((b) => b.match_id))]
  const { data: matches } = round.season_id != null && round.name != null
    ? await supabaseAdmin
        .from('matches')
        .select('id')
        .eq('season_id', round.season_id)
        .eq('round_name', round.name)
        .in('id', matchIds)
    : { data: [] }

  if (!matches || matches.length !== matchIds.length) {
    return NextResponse.json({ error: 'Ugyldige kamp-id\'er' }, { status: 400 })
  }

  // Upsert match_result bets med home_score/away_score (prediction er fjernet)
  const matchResultBets = bets.filter((b) => b.bet_type === 'match_result')
  const rows = matchResultBets.map((b) => {
    const { home_score, away_score } = predictionToScores(b.prediction as '1' | 'X' | '2')
    return {
      user_id: user.id,
      match_id: b.match_id,
      game_id,
      round_id,
      home_score,
      away_score,
    }
  })

  const { error: upsertError } = await supabaseAdmin
    .from('bets')
    .upsert(rows, { onConflict: 'user_id,match_id' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: rows.length })
}
