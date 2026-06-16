import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIp } from '@/lib/rateLimit'
import { getBlockBetMarket } from '@/lib/blockBets'

// Blok Bets deler blokkens budget (1000) med kamp-bets. Legacy-runder tæller
// ikke (samme som submit-bets).
const LEGACY_PRE_BLOCK_ROUND_IDS = [36175, 36177]
const BLOCK_BUDGET = 1000

type Props = { params: Promise<{ id: string }> }
type BlockBetInput = { market_key: string; selection: string; stake: number }

/**
 * Placér/erstat en brugers Blok Bets for én blok. Body: { game_id, bets:[...] }
 * hvor bets er det KOMPLETTE sæt (stake 0 = fjern). Låses når blokkens første
 * kamp er gået i gang. Odds beregnes server-side (klient kan ikke snyde).
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { success } = rateLimit(getIp(req), 'blocks:bets', 20, 5 * 60 * 1000)
  if (!success) return NextResponse.json({ error: 'For mange forsøg. Prøv igen om lidt.' }, { status: 429 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const blockId = parseInt(id)
  if (isNaN(blockId)) return NextResponse.json({ error: 'Ugyldigt block_id' }, { status: 400 })

  const body = await req.json()
  const { game_id: gameId, bets } = body as { game_id?: number; bets: BlockBetInput[] }
  if (!gameId) return NextResponse.json({ error: 'game_id er påkrævet' }, { status: 400 })
  if (!Array.isArray(bets)) return NextResponse.json({ error: 'Manglende bets-array' }, { status: 400 })

  const { data: member } = await supabaseAdmin
    .from('game_members').select('id').eq('game_id', gameId).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Du er ikke med i dette spil' }, { status: 403 })

  const { data: block } = await supabaseAdmin.from('blocks').select('id').eq('id', blockId).single()
  if (!block) return NextResponse.json({ error: 'Blokken findes ikke' }, { status: 404 })

  const { data: blockRounds } = await supabaseAdmin.from('rounds').select('id').eq('block_id', blockId)
  const budgetRoundIds = (blockRounds ?? [])
    .map((r) => r.id as number)
    .filter((rid) => !LEGACY_PRE_BLOCK_ROUND_IDS.includes(rid))
  if (budgetRoundIds.length === 0) return NextResponse.json({ error: 'Blokken har ingen runder' }, { status: 400 })

  const { data: blockMatches } = await supabaseAdmin
    .from('matches').select('id, bet_open, kickoff').in('round_id', budgetRoundIds)
  const matchCount = (blockMatches ?? []).length
  if (matchCount === 0) return NextResponse.json({ error: 'Blokken har ingen kampe endnu' }, { status: 400 })

  // Lås: Blok Bets kan kun lægges indtil blokkens FØRSTE kamp er gået i gang.
  const firstMatch = [...(blockMatches ?? [])].sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)))[0]
  if (firstMatch && !firstMatch.bet_open) {
    return NextResponse.json({ error: 'Blok Bets er låst — blokken er gået i gang' }, { status: 400 })
  }

  // Validér hvert bet + beregn server-odds.
  const rows: Array<{ block_id: number; game_id: number; user_id: string; market_key: string; selection: string; stake: number; odds: number; result: 'pending' }> = []
  let newBlockStake = 0
  for (const b of bets) {
    const market = getBlockBetMarket(b.market_key)
    if (!market) return NextResponse.json({ error: `Ukendt marked: ${b.market_key}` }, { status: 400 })
    const side = market.sides(matchCount).find((s) => s.value === b.selection)
    if (!side) return NextResponse.json({ error: `Ugyldigt valg for ${market.label}` }, { status: 400 })
    if (b.stake < 0) return NextResponse.json({ error: 'Indsats kan ikke være negativ' }, { status: 400 })
    if (b.stake === 0) continue
    if (b.stake < 10) return NextResponse.json({ error: 'Minimum indsats er 10 credits' }, { status: 400 })
    newBlockStake += b.stake
    rows.push({ block_id: blockId, game_id: gameId, user_id: user.id, market_key: b.market_key, selection: b.selection, stake: b.stake, odds: side.odds, result: 'pending' })
  }

  // Budget: kamp-bet-indsats i blokken + nye Blok Bets ≤ 1000.
  const { data: matchBets } = await supabaseAdmin
    .from('bets').select('stake').eq('user_id', user.id).eq('game_id', gameId).in('round_id', budgetRoundIds)
  const matchStake = (matchBets ?? []).reduce((s, b) => s + (b.stake ?? 0), 0)
  if (matchStake + newBlockStake > BLOCK_BUDGET) {
    return NextResponse.json(
      { error: `Du kan højst bruge ${BLOCK_BUDGET} credits i blokken. Du har ${Math.max(0, BLOCK_BUDGET - matchStake)} tilbage.` },
      { status: 400 }
    )
  }

  // Erstat brugerens Blok Bets for denne blok med det nye sæt.
  await supabaseAdmin.from('block_bets').delete().eq('block_id', blockId).eq('game_id', gameId).eq('user_id', user.id)
  if (rows.length > 0) {
    const { error: insErr } = await supabaseAdmin.from('block_bets').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, placed: rows.length })
}
