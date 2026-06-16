import { supabaseAdmin } from '@/lib/supabase'
import { computeBlockBetStats, getBlockBetMarket, type BlockMatchRow } from '@/lib/blockBets'

/**
 * Afgør alle Blok Bets for en blok når den er FÆRDIGSPILLET (alle blokkens
 * kampe finished). Markeder afgøres på de samlede stats, så vi scorer først
 * når hele blokken er spillet — ikke undervejs. Idempotent (sætter absolut).
 *
 * Gevinst = indsats × odds (konsensus-odds sat ved lås; base-odds som fallback).
 */
export async function scoreBlockBets(blockId: number): Promise<number> {
  const { data: rounds } = await supabaseAdmin.from('rounds').select('id').eq('block_id', blockId)
  const roundIds = (rounds ?? []).map((r) => r.id as number)
  if (roundIds.length === 0) return 0

  const { data: matches } = await supabaseAdmin
    .from('matches').select('home_score, away_score, status').in('round_id', roundIds)
  const rows = (matches ?? []) as BlockMatchRow[]
  // Kun afgøre når ALLE blokkens kampe er færdige (markederne er aggregat).
  if (rows.length === 0 || rows.some((m) => m.status !== 'finished')) return 0

  const stats = computeBlockBetStats(rows)
  if (stats.matchCount === 0) return 0

  const { data: bbets } = await supabaseAdmin
    .from('block_bets').select('id, market_key, selection, stake, odds').eq('block_id', blockId)

  let scored = 0
  for (const b of bbets ?? []) {
    const market = getBlockBetMarket(b.market_key as string)
    if (!market) continue
    const winning = market.resolve(stats)
    if (winning == null) continue
    const win = b.selection === winning
    const points = win ? Math.round((b.stake as number) * Number(b.odds)) : 0
    await supabaseAdmin
      .from('block_bets')
      .update({ result: win ? 'win' : 'loss', points_earned: points })
      .eq('id', b.id)
    scored++
  }
  return scored
}
