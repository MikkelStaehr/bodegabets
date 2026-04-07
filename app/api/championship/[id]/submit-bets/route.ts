import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import type { BetType } from '@/types'
import { rateLimit, getIp } from '@/lib/rateLimit'

type Props = { params: Promise<{ id: string }> }

type BetInput = {
  match_id: number
  bet_type: BetType
  prediction: string
  stake: number
}

export async function POST(req: NextRequest, { params }: Props) {
  const { success } = rateLimit(getIp(req), 'championship:submit-bets', 20, 5 * 60 * 1000)
  if (!success) {
    return NextResponse.json({ error: 'For mange forsøg. Prøv igen om lidt.' }, { status: 429 })
  }

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

  // Tjek at championship runden eksisterer og ikke er finished
  const { data: round } = await supabaseAdmin
    .from('championship_rounds')
    .select('id, name, status, betting_closes_at')
    .eq('id', roundId)
    .single()

  if (!round) {
    return NextResponse.json({ error: 'Runde ikke fundet' }, { status: 404 })
  }

  const now = new Date()
  const deadline = round.betting_closes_at ? new Date(round.betting_closes_at) : null
  const canBet = round.status !== 'finished' && (!deadline || deadline > now)
  if (!canBet) {
    return NextResponse.json({ error: 'Runden er ikke åben for bets' }, { status: 400 })
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

  // Valider indsatser
  for (const bet of bets) {
    if (bet.stake < 0) {
      return NextResponse.json({ error: 'Indsats kan ikke være negativ' }, { status: 400 })
    }
    if (bet.stake > 0 && bet.stake < 10) {
      return NextResponse.json({ error: 'Minimum indsats er 10 pt' }, { status: 400 })
    }
  }

  // Validér at alle match_ids tilhører denne championship runde
  const { data: roundMatchRows } = await supabaseAdmin
    .from('championship_round_matches')
    .select('match_id')
    .eq('championship_round_id', roundId)

  const validMatchIds = new Set((roundMatchRows ?? []).map((m) => m.match_id))
  const payloadMatchIds = [...new Set(bets.map((b) => b.match_id))]
  const allValid = payloadMatchIds.every((id) => validMatchIds.has(id))
  if (!allValid) {
    return NextResponse.json({ error: 'Ugyldige kamp-id\'er' }, { status: 400 })
  }

  // Per-kamp bet-luk validering
  const { data: matchDetails } = await supabaseAdmin
    .from('matches')
    .select('id, bet_open')
    .in('id', payloadMatchIds)

  const matchMap = new Map((matchDetails ?? []).map((m) => [m.id, m]))
  const lockedMatches = payloadMatchIds.filter((id) => {
    const m = matchMap.get(id)
    return m && !m.bet_open
  })
  if (lockedMatches.length > 0) {
    return NextResponse.json({ error: 'En eller flere kampe er lukket for bets' }, { status: 400 })
  }

  // Slet eksisterende bets for disse kampe
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

  // Indsæt nye bets (round_id = championship_round_id)
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
