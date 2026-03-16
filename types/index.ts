import type { BetType } from '@/lib/betTypes'

export type Profile = {
  id: string
  username: string
  points: number
  is_admin: boolean
  created_at: string
}

export type Game = {
  id: number
  name: string
  host_id: string
  invite_code: string
  sport: string
  status: 'active' | 'finished'
  created_at: string
}

export type League = {
  id: number
  name: string
  country: string
  is_active: boolean
  /** @deprecated Bruges ikke længere — Bold.dk er eneste datakilde. Kolonnen beholdes i DB. */
  fixturedownload_slug?: string | null
  bold_slug?: string | null
  league_match_id?: number | null
  last_synced_at?: string | null
  sofascore_tournament_id?: string | null
  sofascore_season_id?: string | null
}

export type GameMember = {
  id: number
  game_id: number
  user_id: string
  earnings: number
  joined_at: string
  rounds_played?: number
}

export type Round = {
  id: number
  league_id: number
  name: string
  betting_closes_at: string | null
  status: 'upcoming' | 'open' | 'closed' | 'finished'
  created_at: string
}

export type Match = {
  id: number
  round_id: number
  home_team: string
  away_team: string
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  home_score_ht: number | null
  away_score_ht: number | null
  status: 'scheduled' | 'live' | 'halftime' | 'finished' | 'cancelled'
  sofascore_event_id?: string | null
  league_match_id?: number | null
}

export type { BetType }

export type Bet = {
  id: number
  user_id: string
  match_id: number
  game_id: number
  prediction: string
  bet_type: BetType
  stake: number
  result: 'win' | 'loss' | 'pending' | null
  points_earned: number | null
  created_at: string
}

export type RoundScore = {
  id: number
  user_id: string
  round_id: number
  game_id: number
  points_earned: number
  earnings_delta: number
  created_at: string
}

// Extended types med joins
export type GameWithMemberCount = Game & {
  member_count: number
  user_earnings?: number
}

export type MatchWithBets = Match & {
  user_bets?: Bet[]
}

export type LeaderboardEntry = {
  user_id: string
  username: string
  earnings: number
  rank: number
}
