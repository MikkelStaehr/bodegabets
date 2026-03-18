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
    .select('name, season_id, status, betting_closes_at')
    .eq('id', roundId)
    .single()

  // Accepter både 'open' og 'upcoming' (sync opretter runder som 'upcoming')
  const canBet = round && (round.status === 'open' || round.status === 'upcoming')
  if (!canBet) {
    return NextResponse.json({ error: 'Runden er ikke åben for bets' }, { status: 400 })
  }

  if (round.betting_closes_at && new Date(round.betting_closes_at) < new Date()) {
    return NextResponse.json({ error: 'Betting-deadline er overskredet' }, { status: 400 })
  }

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

  // Validér at alle match_ids tilhører denne runde
  const payloadMatchIds = [...new Set(bets.map((b) => b.match_id))]
  const { data: roundMatches } = await supabaseAdmin
    .from('matches')
    .select('id, bet_open, kickoff')
    .eq('round_id', roundId)

  const roundMatchIds = (roundMatches ?? []).map((m) => m.id)
  const allValid = payloadMatchIds.every((id) => roundMatchIds.includes(id))
  if (!allValid) {
    return NextResponse.json({ error: 'Ugyldige kamp-id\'er' }, { status: 400 })
  }

  // Per-kamp bet-luk validering
  const matchMap = new Map((roundMatches ?? []).map((m) => [m.id, m as { id: number; bet_open: boolean; kickoff: string }]))
  const lockedMatches = payloadMatchIds.filter((id) => {
    const m = matchMap.get(id)
    return m && !m.bet_open
  })
  if (lockedMatches.length > 0) {
    return NextResponse.json({ error: 'En eller flere kampe er lukket for bets' }, { status: 400 })
  }

  // Slet kun eksisterende bets for ÅBNE kampe (bevar bets på finished/locked kampe)
  const openMatchIds = (roundMatches ?? []).filter((m) => m.bet_open).map((m) => m.id)
  if (openMatchIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('bets')
      .delete()
      .eq('user_id', user.id)
      .in('match_id', openMatchIds)

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

  // Opdater round_members.betting_balance = 1000 - (locked bets + nye bets)
  const lockedMatchIds = (roundMatches ?? []).filter((m) => !m.bet_open).map((m) => m.id)
  let lockedStake = 0
  if (lockedMatchIds.length > 0) {
    const { data: lockedBets } = await supabaseAdmin
      .from('bets')
      .select('stake')
      .eq('user_id', user.id)
      .in('match_id', lockedMatchIds)
    lockedStake = (lockedBets ?? []).reduce((sum, b) => sum + (b.stake ?? 0), 0)
  }
  const newStake = bets.reduce((sum, b) => sum + b.stake, 0)
  await supabaseAdmin
    .from('round_members')
    .update({ betting_balance: 1000 - lockedStake - newStake })
    .eq('user_id', user.id)
    .eq('round_id', roundId)
    .eq('game_id', bodyGameId)

  return NextResponse.json({ ok: true, bets_submitted: rows.length })
}
