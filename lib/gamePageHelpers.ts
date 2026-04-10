// Utility functions extracted from app/games/[id]/page.tsx

export function getSportTheme(sport: string) {
  if (sport === 'cycling') {
    return { primary: '#1E3A5F', primaryLight: '#2B4F7A', accent: '#4A6FA5' }
  }
  return { primary: '#2C4A3E', primaryLight: '#3D6B5A', accent: '#2C4A3E' }
}

export function assignRanks<T extends { earnings: number }>(rows: T[]): (T & { rank: number })[] {
  return rows.map((row, i, arr) => ({
    ...row,
    rank:
      i === 0
        ? 1
        : row.earnings === arr[i - 1].earnings
        ? (arr[i - 1] as T & { rank: number }).rank
        : i + 1,
  }))
}

type RoundLike = {
  status: string
  betting_closes_at: string | null
}

export function computeRoundStatus(round: RoundLike, now: Date): 'upcoming' | 'open' | 'active' | 'finished' {
  if (round.status === 'finished') return 'finished'
  if (!round.betting_closes_at) return 'upcoming'
  const closes = new Date(round.betting_closes_at)
  if (closes > now) return 'open'
  return 'active'
}

export function getLeagueAbbr(name: string): { abbr: string; type: 'league' | 'cup' } {
  const lower = name.toLowerCase()
  if (lower.includes('premier league')) return { abbr: 'PL', type: 'league' }
  if (lower.includes('champions league')) return { abbr: 'UCL', type: 'cup' }
  if (lower.includes('europa league')) return { abbr: 'UEL', type: 'cup' }
  if (lower.includes('conference league')) return { abbr: 'UECL', type: 'cup' }
  if (lower.includes('superliga')) return { abbr: 'SL', type: 'league' }
  if (lower.includes('la liga') || lower.includes('laliga')) return { abbr: 'LL', type: 'league' }
  if (lower.includes('bundesliga')) return { abbr: 'BL', type: 'league' }
  if (lower.includes('serie a')) return { abbr: 'SA', type: 'league' }
  if (lower.includes('ligue 1')) return { abbr: 'L1', type: 'league' }
  const words = name.split(/\s+/)
  return { abbr: words.map((w) => w[0]).join('').toUpperCase().slice(0, 3), type: 'league' }
}
