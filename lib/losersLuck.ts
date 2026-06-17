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
export const LOSERS_LUCK_COUNT = 2 // nederste 2 i sæsonen

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

  const pts = new Map<string, number>()
  for (const u of userIds) pts.set(u, 0)
  for (const s of scores ?? []) pts.set(s.user_id, (pts.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0))

  // Deltog spilleren i den FORRIGE blok? En spiller der er holdt op med at
  // spille skal IKKE have comeback-hjælp — og må heller ikke optage en plads
  // (ellers rykker en midter-spiller fejlagtigt ind i stedet, se nedenfor).
  const priorBlockNums = (blocks ?? []).map((b) => b.block_number as number).filter((n) => n < thisBlockNum)
  const prevBlockNum = priorBlockNums.length ? Math.max(...priorBlockNums) : null
  const prevBlockId = prevBlockNum != null
    ? ((blocks ?? []).find((b) => (b.block_number as number) === prevBlockNum)?.id as number | undefined) ?? null
    : null
  const prevRoundIds = prevBlockId != null
    ? (rounds ?? []).filter((r) => r.block_id === prevBlockId).map((r) => r.id as number)
    : []
  let participated = new Set<string>(userIds)
  if (prevRoundIds.length > 0) {
    const { data: prevBets } = await supabaseAdmin
      .from('bets').select('user_id').eq('game_id', gameId).in('round_id', prevRoundIds)
    participated = new Set((prevBets ?? []).map((b) => b.user_id as string))
  }

  // Rangér efter PRÆSTATION (point) — ikke blok-sejre. En højtscorende spiller
  // uden blok-sejr er ikke en "taber". Tag de nederste N, og fjern dem der ikke
  // deltog i forrige blok UDEN at fylde pladsen op — så en midter-spiller ikke
  // arver en inaktiv spillers plads.
  const byPointsAsc = [...userIds].sort((a, z) =>
    (pts.get(a) ?? 0) - (pts.get(z) ?? 0) ||
    usernameById.get(a)!.localeCompare(usernameById.get(z)!)
  )
  const bottom = byPointsAsc.slice(0, LOSERS_LUCK_COUNT)
  return new Set(bottom.filter((u) => participated.has(u)))
}
