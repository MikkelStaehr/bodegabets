import { supabaseAdmin } from '@/lib/supabase'
import { blockBetConsensusOdds } from '@/lib/blockBets'

/**
 * Beregn & gem KONSENSUS-odds for en bloks Blok Bets — på samme måde som
 * kamp-bets får konsensus-odds ved lås (lib/syncMatchScores). Køres når blokkens
 * FØRSTE kamp er gået i gang (betting lukket), så fordelingen er endelig.
 *
 * Grupperet pr. SPIL + marked: odds = funktion af hvor mange der backede
 * markedet ift. alle der lagde mindst ét Blok Bet i blokken (limits 1.2–1.8).
 *
 * Idempotent: efter betting-luk ændrer fordelingen sig ikke, så gentagne kald
 * giver samme odds.
 */
export async function lockBlockBetConsensus(blockId: number): Promise<void> {
  // Er blokkens tidligste kamp gået i gang? Ellers er Blok Bets stadig åbne.
  const { data: rounds } = await supabaseAdmin
    .from('rounds').select('id').eq('block_id', blockId)
  const roundIds = (rounds ?? []).map((r) => r.id as number)
  if (roundIds.length === 0) return

  const { data: firstMatch } = await supabaseAdmin
    .from('matches').select('bet_open')
    .in('round_id', roundIds)
    .order('kickoff', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstMatch || firstMatch.bet_open !== false) return // endnu åben → for tidligt

  const { data: bets } = await supabaseAdmin
    .from('block_bets').select('id, game_id, user_id, market_key').eq('block_id', blockId)
  if (!bets?.length) return

  // Pr. spil: distinct deltagere + backers pr. marked → konsensus-odds.
  const byGame = new Map<number, typeof bets>()
  for (const b of bets) {
    const g = byGame.get(b.game_id as number) ?? []
    g.push(b)
    byGame.set(b.game_id as number, g)
  }

  for (const gameBets of byGame.values()) {
    const participants = new Set(gameBets.map((b) => b.user_id)).size
    const backers = new Map<string, number>()
    for (const b of gameBets) {
      const k = b.market_key as string
      backers.set(k, (backers.get(k) ?? 0) + 1)
    }
    for (const b of gameBets) {
      const odds = blockBetConsensusOdds(backers.get(b.market_key as string) ?? 0, participants)
      await supabaseAdmin.from('block_bets').update({ odds }).eq('id', b.id)
    }
  }
}
