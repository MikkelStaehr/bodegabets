import { supabaseAdmin } from '@/lib/supabase'

/**
 * 🍀 Losers Luck — comeback-mekanik. De NEDERSTE spillere i sæson-stillingen
 * (ved blokkens START) får en boost på deres gevinster i blokken, så ingen
 * stikker af. Beneficienterne afgøres ud fra resultater FØR blokken — så det
 * er reelt låst ved blok-start og kan ikke game'es midt i blokken.
 *
 * Kun aktivt for slutrunde-spil (seasons.credits_per_block).
 */
export const LOSERS_LUCK_BOOST = 1.2 // +20% på vundne bets
// Antal modtagere skalerer med feltet: 1 ved ≤4 aktive deltagere, ellers 2.
// (Med få spillere er 2 for stor en andel af feltet.)
const losersLuckCount = (activeParticipants: number) => (activeParticipants <= 4 ? 1 : 2)

export async function getLosersLuckUserIds(gameId: number, blockId: number | null): Promise<Set<string>> {
  if (blockId == null) return new Set()

  const { data: gs } = await supabaseAdmin.from('game_seasons').select('season_id').eq('game_id', gameId)
  const seasonIds = (gs ?? []).map((g) => g.season_id as number)
  if (seasonIds.length === 0) return new Set()

  // Kun slutrunde-spil (credits_per_block) har Losers Luck.
  const { data: seasonRows } = await supabaseAdmin
    .from('seasons').select('credits_per_block').in('id', seasonIds)
  const enabled = (seasonRows ?? []).some((s) => (s as { credits_per_block?: boolean }).credits_per_block === true)
  if (!enabled) return new Set()

  const { data: members } = await supabaseAdmin
    .from('game_members').select('user_id, profiles!inner(username)').eq('game_id', gameId)
  if (!members?.length) return new Set()
  const userIds = members.map((m) => m.user_id as string)
  const usernameById = new Map(members.map((m) => [m.user_id as string, (m.profiles as unknown as { username: string }).username ?? '']))

  const { data: rounds } = await supabaseAdmin.from('rounds').select('id, block_id, status').in('season_id', seasonIds)
  const { data: blocks } = await supabaseAdmin.from('blocks').select('id, block_number').in('season_id', seasonIds)
  const blockNumById = new Map((blocks ?? []).map((b) => [b.id as number, b.block_number as number]))
  const thisBlockNum = blockNumById.get(blockId)
  if (thisBlockNum == null) return new Set()

  // Runder afgjort i TIDLIGERE blokke (lavere block_number). IKKE bare alle
  // finished runder udenfor blokken — det ville fejlagtigt tælle SENERE blokkes
  // afsluttede runder med (fx blok 2's runde som "prior" til blok 1). Første blok
  // har ingen tidligere blokke → ingen Losers Luck (man skal først se bunden).
  const prior = (rounds ?? []).filter(
    (r) => r.status === 'finished' && (blockNumById.get(r.block_id as number) ?? Infinity) < thisBlockNum
  )
  const priorIds = prior.map((r) => r.id as number)
  if (priorIds.length === 0) return new Set()

  const { data: scores } = await supabaseAdmin
    .from('round_scores').select('user_id, round_id, earnings_delta').eq('game_id', gameId).in('round_id', priorIds)

  // Losers Luck bedømmes på PLACERINGEN i den FORRIGE blok — ikke samlede
  // sæson-point — så fx blok-vinderen aldrig får comeback-hjælp. Kun spillere
  // der DELTOG i forrige blok rangeres; de nederste N på blok-point får boostet.
  const priorBlockNums = (blocks ?? []).map((b) => b.block_number as number).filter((n) => n < thisBlockNum)
  const prevBlockNum = priorBlockNums.length ? Math.max(...priorBlockNums) : null
  if (prevBlockNum == null) return new Set()
  const prevBlockId = ((blocks ?? []).find((b) => (b.block_number as number) === prevBlockNum)?.id as number | undefined) ?? null
  const prevRoundIds = prevBlockId != null
    ? (rounds ?? []).filter((r) => r.block_id === prevBlockId).map((r) => r.id as number)
    : []
  if (prevRoundIds.length === 0) return new Set()
  const prevSet = new Set(prevRoundIds)

  // Point pr. spiller i FORRIGE blok (kun dens runder).
  const prevPts = new Map<string, number>()
  for (const s of scores ?? []) {
    if (!prevSet.has(s.round_id as number)) continue
    prevPts.set(s.user_id, (prevPts.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0))
  }

  // Kun spillere der deltog i forrige blok (lagde bets der) kan rangeres/få boost.
  const { data: prevBets } = await supabaseAdmin
    .from('bets').select('user_id').eq('game_id', gameId).in('round_id', prevRoundIds)
  const participated = new Set((prevBets ?? []).map((b) => b.user_id as string))
  const participants = userIds.filter((u) => participated.has(u))

  // Nederste N på forrige bloks point → Losers Luck. N skalerer med feltet.
  const sortedAsc = [...participants].sort((a, z) =>
    (prevPts.get(a) ?? 0) - (prevPts.get(z) ?? 0) ||
    usernameById.get(a)!.localeCompare(usernameById.get(z)!)
  )
  return new Set(sortedAsc.slice(0, losersLuckCount(participants.length)))
}
