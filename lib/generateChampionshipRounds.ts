import { supabaseAdmin } from '@/lib/supabase'

export type ChampionshipSeason = '2025/26' | '2026/27'

const SEASON_DATES: Record<ChampionshipSeason, { start: Date; end: Date }> = {
  '2025/26': {
    start: new Date(Date.UTC(2025, 7, 5)),     // 5. aug 2025
    end: new Date(Date.UTC(2026, 4, 31, 23, 59, 59)), // 31. maj 2026
  },
  '2026/27': {
    start: new Date(Date.UTC(2026, 7, 4)),     // 4. aug 2026
    end: new Date(Date.UTC(2027, 4, 31, 23, 59, 59)), // 31. maj 2027
  },
}

/**
 * Genererer alle mesterskabsrunder for en sæson.
 * En runde = tirsdag 00:01 UTC → mandag 23:59 UTC
 * Idempotent per sæson.
 */
export async function generateChampionshipRounds(
  season: ChampionshipSeason
): Promise<{ created: number }> {
  // Tjek om runder allerede eksisterer for denne sæson
  const { count } = await supabaseAdmin
    .from('championship_rounds')
    .select('id', { count: 'exact', head: true })
    .eq('season', season)

  if (count && count > 0) {
    return { created: 0 }
  }

  const { start: SEASON_START, end: SEASON_END } = SEASON_DATES[season]

  // Find første tirsdag >= SEASON_START
  const firstTuesday = new Date(SEASON_START)
  while (firstTuesday.getUTCDay() !== 2) {
    firstTuesday.setUTCDate(firstTuesday.getUTCDate() + 1)
  }
  firstTuesday.setUTCHours(0, 1, 0, 0)

  const rounds: Array<{
    name: string
    status: string
    betting_closes_at: string
    season: string
  }> = []

  let roundNumber = 1
  const current = new Date(firstTuesday)

  while (current < SEASON_END) {
    const mondayEnd = new Date(current)
    mondayEnd.setUTCDate(current.getUTCDate() + 6)
    mondayEnd.setUTCHours(23, 59, 0, 0)

    if (mondayEnd > SEASON_END) break

    rounds.push({
      name: `Runde ${roundNumber}`,
      status: 'upcoming',
      betting_closes_at: mondayEnd.toISOString(),
      season,
    })

    roundNumber++
    current.setUTCDate(current.getUTCDate() + 7)
  }

  if (rounds.length === 0) return { created: 0 }

  const { error } = await supabaseAdmin
    .from('championship_rounds')
    .insert(rounds)

  if (error) {
    console.error('[generateChampionshipRounds] Insert fejl:', error)
    throw new Error(error.message)
  }

  return { created: rounds.length }
}
