'use client'

import { useGameState, type GameState } from '@/hooks/useGameState'
import LeaderboardTabs from './LeaderboardTabs'

type Theme = {
  primary: string
  primaryLight: string
}

type Props = {
  gameId: number
  currentUserId: string
  initialState: GameState
  theme: Theme
  /** 'main'/'main-no-leaderboard': viser det tab-delte leaderboard i main.
   *  'sidebar': intet (leaderboardet ligger i main). */
  variant?: 'main' | 'main-no-leaderboard' | 'sidebar'
  currentRoundName?: string
}

/**
 * Live fodbold-sektion: poller /api/games/[id]/state og renderer det tab-delte
 * leaderboard (Blok / Sæson) med altid-friske data + bevægelses-pile.
 */
export default function FootballLiveSection({
  gameId,
  initialState,
  variant = 'main',
}: Props) {
  const { state } = useGameState(gameId, { initialState })
  const active = state ?? initialState

  // Sidebar: intet ekstra — leaderboardet ligger i main.
  if (variant === 'sidebar') return null

  return <LeaderboardTabs tabs={active.leaderboardTabs} gameId={gameId} />
}
