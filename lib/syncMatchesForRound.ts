/**
 * syncMatchesForRound.ts
 * Nyt skema: Matches populeres af syncLeagueMatches per sæson.
 * Denne funktion er nu en no-op — matches findes allerede i DB.
 * Beholdes for bagudkompatibilitet med kaldere (fx rounds page).
 */

import { supabaseAdmin } from '@/lib/supabase'

export async function syncMatchesForRound(
  _gameId: number,
  roundId: number
): Promise<void> {
  // Tjek at runden eksisterer og har matches
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id, name')
    .eq('id', roundId)
    .single()

  if (!round?.season_id) return

  // I nyt skema er matches allerede synkroniseret af syncLeagueMatches.
  // Ingen handling nødvendig — matches har round_id og tilhører runden.
}
