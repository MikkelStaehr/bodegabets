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
  // Runder afgjort FØR denne blok (ekskl. blokkens egne runder).
  const prior = (rounds ?? []).filter((r) => r.status === 'finished' && r.block_id !== blockId)
  const priorIds = prior.map((r) => r.id as number)
  if (priorIds.length === 0) return new Set() // første blok → ingen Losers Luck

  const { data: scores } = await supabaseAdmin
    .from('round_scores').select('user_id, round_id, earnings_delta').eq('game_id', gameId).in('round_id', priorIds)

  const pts = new Map<string, number>()
  for (const u of userIds) pts.set(u, 0)
  for (const s of scores ?? []) pts.set(s.user_id, (pts.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0))

  // Blok-sejre over blokke der ER afgjort før denne blok.
  const priorSet = new Set(priorIds)
  const { data: blocks } = await supabaseAdmin.from('blocks').select('id').in('season_id', seasonIds)
  const wins = new Map<string, number>()
  for (const b of blocks ?? []) {
    if (b.id === blockId) continue
    const brs = (rounds ?? []).filter((r) => r.block_id === b.id).map((r) => r.id as number)
    if (brs.length === 0 || !brs.every((rid) => priorSet.has(rid))) continue
    const tot = new Map<string, number>()
    for (const u of userIds) tot.set(u, 0)
    for (const s of scores ?? []) if (brs.includes(s.round_id as number)) tot.set(s.user_id, (tot.get(s.user_id) ?? 0) + (Number(s.earnings_delta) || 0))
    let max = 0
    for (const v of tot.values()) if (v > max) max = v
    if (max > 0) for (const [u, v] of tot) if (v === max) wins.set(u, (wins.get(u) ?? 0) + 1)
  }

  // Rangér som sæson-tabellen (blok-sejre, så point), tag de nederste N.
  const sorted = [...userIds].sort((a, z) =>
    (wins.get(z) ?? 0) - (wins.get(a) ?? 0) ||
    (pts.get(z) ?? 0) - (pts.get(a) ?? 0) ||
    usernameById.get(a)!.localeCompare(usernameById.get(z)!)
  )
  return new Set(sorted.slice(-LOSERS_LUCK_COUNT))
}
