import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import type { BetType } from '@/types'
import { rateLimit, getIp } from '@/lib/rateLimit'
import { blockBudgetFor } from '@/lib/blockBudget'

type Props = { params: Promise<{ id: string }> }

type BetInput = {
  match_id: number
  bet_type: BetType
  prediction: string
  stake: number
}

export async function POST(req: NextRequest, { params }: Props) {
  const { success } = rateLimit(getIp(req), 'rounds:submit-bets', 20, 5 * 60 * 1000)
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

  // Tjek at runden stadig er åben
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('name, season_id, status, block_id')
    .eq('id', roundId)
    .single()

  // Kun åbne runder tillader bets
  const canBet = round && round.status === 'open'
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

  // Valider indsatser (minimum 10 credits for side-bets; match_result har stake 0)
  for (const bet of bets) {
    if (bet.stake < 0) {
      return NextResponse.json({ error: 'Indsats kan ikke være negativ' }, { status: 400 })
    }
    if (bet.stake > 0 && bet.stake < 10) {
      return NextResponse.json({ error: 'Minimum indsats er 10 credits' }, { status: 400 })
    }
  }

  // ── Kupon-/budget-runder ──────────────────────────────────────────────────
  // VM (credits_per_block): hele blokken (ekskl. legacy-runde) hører til samme
  // kupon og deler budget. Ellers kun denne runde. Beregnes FØR validering, så
  // bets kan spænde over blokkens dage og round_id sættes pr. kamp.
  const LEGACY_PRE_BLOCK_ROUND_IDS = [36175]
  const roundBlockId = (round as { block_id?: number | null }).block_id ?? null
  let creditsPerBlock = false
  if (roundBlockId) {
    const { data: seasonRow } = await supabaseAdmin
      .from('seasons')
      .select('credits_per_block')
      .eq('id', round.season_id)
      .single()
    creditsPerBlock = (seasonRow as { credits_per_block?: boolean } | null)?.credits_per_block === true
  }

  let budgetRoundIds: number[] = [roundId]
  if (creditsPerBlock && roundBlockId) {
    const { data: blockRounds } = await supabaseAdmin
      .from('rounds')
      .select('id')
      .eq('block_id', roundBlockId)
    budgetRoundIds = (blockRounds ?? [])
      .map((r) => r.id as number)
      .filter((rid) => !LEGACY_PRE_BLOCK_ROUND_IDS.includes(rid))
    if (!budgetRoundIds.includes(roundId)) budgetRoundIds.push(roundId)
  }

  // Validér match_ids mod kuponens runder, og find round_id pr. kamp (bets kan
  // spænde over blokkens dage). Per-kamp bet-luk håndhæves samtidig.
  const payloadMatchIds = [...new Set(bets.map((b) => b.match_id))]
  const { data: couponMatches } = await supabaseAdmin
    .from('matches')
    .select('id, round_id, bet_open')
    .in('round_id', budgetRoundIds)

  const matchMap = new Map(
    (couponMatches ?? []).map((m) => [m.id as number, m as { id: number; round_id: number; bet_open: boolean }])
  )
  const allValid = payloadMatchIds.every((id) => matchMap.has(id))
  if (!allValid) {
    return NextResponse.json({ error: 'Ugyldige kamp-id\'er' }, { status: 400 })
  }
  const lockedMatches = payloadMatchIds.filter((id) => {
    const m = matchMap.get(id)
    return m && !m.bet_open
  })
  if (lockedMatches.length > 0) {
    return NextResponse.json({ error: 'En eller flere kampe er lukket for bets' }, { status: 400 })
  }

  // Håndhæv budget-loftet: allerede-placerede indsatser i budgettet (på kampe
  // der IKKE erstattes i denne submission) + de nye indsatser må ikke overstige
  // blokkens budget (typisk 1000, men kan have engangs-override — se blockBudget).
  const budgetCap = creditsPerBlock ? blockBudgetFor(roundBlockId) : 1000
  const newPayloadStake = bets.reduce((sum, b) => sum + (b.stake ?? 0), 0)
  const { data: existingBudgetBets } = await supabaseAdmin
    .from('bets')
    .select('stake, match_id')
    .eq('user_id', user.id)
    .eq('game_id', bodyGameId)
    .in('round_id', budgetRoundIds)
  const existingBudgetStake = (existingBudgetBets ?? [])
    .filter((b) => !payloadMatchIds.includes(b.match_id as number))
    .reduce((sum, b) => sum + (b.stake ?? 0), 0)
  if (existingBudgetStake + newPayloadStake > budgetCap) {
    const scope = creditsPerBlock ? 'blokken' : 'runden'
    return NextResponse.json(
      {
        error: `Du kan højst bruge ${budgetCap} credits i ${scope}. Du har ${Math.max(0, budgetCap - existingBudgetStake)} tilbage.`,
      },
      { status: 400 }
    )
  }

  // Slet kun eksisterende bets for de kampe der er med i denne submission
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

  // Indsæt nye bets — round_id sættes pr. kamp (kuponen kan spænde over flere
  // af blokkens runder/dage).
  const rows = bets.map((b) => ({
    round_id: matchMap.get(b.match_id)!.round_id,
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

  // Opdater betting_balance ud fra blokkens/rundens samlede forbrug
  // (budgetRoundIds er beregnet ovenfor).
  const { data: allRoundBets, error: betsQueryError } = await supabaseAdmin
    .from('bets')
    .select('stake')
    .eq('user_id', user.id)
    .in('round_id', budgetRoundIds)
    .eq('game_id', bodyGameId)

  if (betsQueryError) {
    console.error('[submit-bets] Fejl ved hentning af bets for balance:', betsQueryError.message)
  }

  const totalStake = (allRoundBets ?? []).reduce((sum, b) => sum + (b.stake ?? 0), 0)
  const newBalance = budgetCap - totalStake

  const { error: balanceError, count } = await supabaseAdmin
    .from('round_members')
    .upsert(
      {
        user_id: user.id,
        round_id: roundId,
        game_id: bodyGameId,
        betting_balance: newBalance,
      },
      { onConflict: 'user_id,round_id,game_id' }
    )

  if (balanceError) {
    console.error('[submit-bets] Fejl ved betting_balance upsert:', balanceError.message)
  } else {
    console.log(`[submit-bets] betting_balance sat til ${newBalance} for user=${user.id.slice(0, 8)}, round=${roundId}, game=${bodyGameId}`)
  }

  return NextResponse.json({ ok: true, bets_submitted: rows.length })
}
