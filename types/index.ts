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
  description: string | null
  host_id: string
  invite_code: string
  sport: string
  status: 'active' | 'finished'
  league_id: number | null
  created_at: string
}

export type League = {
  id: number
  name: string
  country: string
  is_active: boolean
  total_matches?: number
  fixturedownload_slug?: string | null
  bold_slug?: string | null
  league_match_id?: number | null
  sync_status?: 'ok' | 'error' | 'pending'
  sync_error?: string | null
  last_synced_at?: string | null
  sofascore_tournament_id?: string | null
  sofascore_season_id?: string | null
}

export type GameMember = {
  id: number
  game_id: number
  user_id: string
  points: number
  joined_at: string
  current_streak?: number
  total_wins?: number
  total_losses?: number
  rounds_played?: number
}

export type Round = {
  id: number
  league_id: number
  name: string
  stage: string
  betting_opens_at: string | null
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
  betting_closes_at: string | null
  home_score: number | null
  away_score: number | null
  home_ht_score: number | null
  away_ht_score: number | null
  yellow_cards: number | null
  red_cards: number | null
  first_scorer: string | null
  odds_home: number | null
  odds_draw: number | null
  odds_away: number | null
  status: 'scheduled' | 'live' | 'halftime' | 'finished' | 'cancelled'
  source_url: string | null
  sofascore_event_id?: string | null
  league_match_id?: number | null
  bold_match_id?: number | null
}

export type MatchSidebetOption = {
  id: number
  match_id: number
  bet_type: BetType
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
  potential_win: number | null
  result: 'win' | 'loss' | 'pending' | null
  points_delta: number | null
  created_at: string
}

export type RoundScore = {
  id: number
  user_id: string
  round_id: number
  game_id: number
  points_earned: number
  created_at: string
}

// Extended types med joins
export type GameWithMemberCount = Game & {
  member_count: number
  user_points?: number
}

export type MatchWithBets = Match & {
  user_bets?: Bet[]
  sidebet_options?: MatchSidebetOption[]
}

export type LeaderboardEntry = {
  user_id: string
  username: string
  points: number
  rank: number
}
