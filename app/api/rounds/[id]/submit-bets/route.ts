import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import type { BetType } from '@/types'

type Props = { params: Promise<{ id: string }> }

type BetInput = {
  match_id: number
  bet_type: BetType
  prediction: string
  stake: number
}

export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roundId = parseInt(id)
  if (isNaN(roundId)) {
    return NextResponse.json({ error: 'Ugyldigt round_id' }, { status: 400 })
  }

  const body = await req.json()
  const { bets, game_id: bodyGameId } = body as { bets: BetInput[]; game_id?: number }

  if (!Array.isArray(bets) || bets.length === 0) {
    return NextResponse.json({ error: 'Manglende eller tom bets-array' }, { status: 400 })
  }

  if (!bodyGameId) {
    return NextResponse.json({ error: 'game_id er påkrævet' }, { status: 400 })
  }

  // Tjek at runden stadig er åben
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('status, betting_closes_at, season_id, name')
    .eq('id', roundId)
    .single()

  // Accepter både 'open' og 'upcoming' (sync opretter runder som 'upcoming')
  const canBet = round && (round.status === 'open' || round.status === 'upcoming')
  if (!canBet) {
    return NextResponse.json({ error: 'Runden er ikke åben for bets' }, { status: 400 })
  }

  // Per-kamp deadline: hver kamp låses 30 min før kickoff (betting_closes_at blokerer ikke længere)

  // Tjek at brugeren er game_member
  const { data: member } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', bodyGameId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Du er ikke med i dette spil' }, { status: 403 })
  }

  // Valider indsatser (minimum 10 pt for side-bets; match_result har stake 0)
  for (const bet of bets) {
    if (bet.stake < 0) {
      return NextResponse.json({ error: 'Indsats kan ikke være negativ' }, { status: 400 })
    }
    if (bet.stake > 0 && bet.stake < 10) {
      return NextResponse.json({ error: 'Minimum indsats er 10 pt' }, { status: 400 })
    }
  }

  // Validér at alle match_ids tilhører denne runde og at kickoff > now() + 30 min
  const payloadMatchIds = [...new Set(bets.map((b) => b.match_id))]
  const { data: roundMatches } = round?.season_id != null && round?.name != null
    ? await supabaseAdmin
        .from('matches')
        .select('id, kickoff')
        .eq('season_id', round.season_id)
        .eq('round_name', round.name)
    : { data: [] }

  const matchById = new Map((roundMatches ?? []).map((m) => [m.id, m]))
  const now = new Date()
  const lockThreshold = new Date(now.getTime() + 30 * 60 * 1000)

  for (const matchId of payloadMatchIds) {
    const m = matchById.get(matchId)
    if (!m) {
      return NextResponse.json({ error: 'Ugyldige kamp-id\'er' }, { status: 400 })
    }
    const kickoff = (m as { kickoff?: string }).kickoff
    if (kickoff && new Date(kickoff) < lockThreshold) {
      return NextResponse.json(
        { error: 'En eller flere kampe er låst (kickoff inden for 30 min)' },
        { status: 400 }
      )
    }
  }

  // Slet kun eksisterende bets for de kampe vi erstatter (behold bets på låste kampe)
  if (payloadMatchIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('bets')
      .delete()
      .eq('user_id', user.id)
      .in('match_id', payloadMatchIds)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }
  }

  // Indsæt nye bets (inkl. round_id)
  const rows = bets.map((b) => ({
    round_id: roundId,
    game_id: bodyGameId,
    match_id: b.match_id,
    user_id: user.id,
    bet_type: b.bet_type,
    prediction: b.prediction,
    stake: b.stake,
    result: 'pending' as const,
  }))

  const { error: insertError } = await supabaseAdmin.from('bets').insert(rows)

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ ok: true, bets_submitted: rows.length })
}
