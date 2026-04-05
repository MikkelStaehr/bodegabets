import { supabaseAdmin } from '@/lib/supabase'

/**
 * Genererer alle mesterskabsrunder for sæsonen 2025/2026.
 * Sæson: 5. august 2025 → 31. maj 2026
 * En runde = tirsdag 00:01 UTC → mandag 23:59 UTC
 * Idempotent: returnerer tidligt hvis runder allerede eksisterer.
 */
export async function generateChampionshipRounds(): Promise<{ created: number }> {
  // Tjek om der allerede er runder
  const { count } = await supabaseAdmin
    .from('championship_rounds')
    .select('id', { count: 'exact', head: true })

  if (count && count > 0) {
    console.log(`[generateChampionshipRounds] ${count} runder eksisterer allerede — skipper`)
    return { created: 0 }
  }

  const SEASON_START = new Date(Date.UTC(2025, 7, 5)) // 5. aug 2025
  const SEASON_END = new Date(Date.UTC(2026, 4, 31, 23, 59, 59)) // 31. maj 2026

  // Find første tirsdag >= SEASON_START
  const firstTuesday = new Date(SEASON_START)
  while (firstTuesday.getUTCDay() !== 2) {
    firstTuesday.setUTCDate(firstTuesday.getUTCDate() + 1)
  }
  firstTuesday.setUTCHours(0, 1, 0, 0) // 00:01 UTC

  const rounds: Array<{
    name: string
    status: string
    betting_closes_at: string
  }> = []

  let roundNumber = 1
  const current = new Date(firstTuesday)

  while (current < SEASON_END) {
    // Rundens start = tirsdag 00:01
    // Rundens slut = mandag 23:59 (6 dage senere)
    const mondayEnd = new Date(current)
    mondayEnd.setUTCDate(current.getUTCDate() + 6)
    mondayEnd.setUTCHours(23, 59, 0, 0)

    // Stop hvis mandagen er efter sæsonens slut
    if (mondayEnd > SEASON_END) break

    rounds.push({
      name: `Runde ${roundNumber}`,
      status: 'upcoming',
      betting_closes_at: mondayEnd.toISOString(),
    })

    roundNumber++
    current.setUTCDate(current.getUTCDate() + 7) // Næste tirsdag
  }

  if (rounds.length === 0) return { created: 0 }

  // Batch insert
  const { error } = await supabaseAdmin
    .from('championship_rounds')
    .insert(rounds)

  if (error) {
    console.error('[generateChampionshipRounds] Insert fejl:', error)
    throw new Error(error.message)
  }

  console.log(`[generateChampionshipRounds] Oprettet ${rounds.length} runder`)
  return { created: rounds.length }
}
