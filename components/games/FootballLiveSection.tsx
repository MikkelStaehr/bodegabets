'use client'

import { useGameState, type GameState } from '@/hooks/useGameState'
import Leaderboard from './Leaderboard'
import BlockLeaderboard from './BlockLeaderboard'

type Theme = {
  primary: string
  primaryLight: string
}

type Props = {
  gameId: number
  currentUserId: string
  initialState: GameState
  theme: Theme
}

/**
 * Live fodbold-sektion: poller /api/games/[id]/state og renderer
 * block-leaderboard + fælles leaderboard med altid-friske data.
 * Erstatter den tidligere server-rendering + isolerede Leaderboard-fetch.
 */
export default function FootballLiveSection({
  gameId,
  currentUserId,
  initialState,
  theme,
}: Props) {
  const { state } = useGameState(gameId, { initialState })
  const active = state ?? initialState

  return (
    <>
      {active.activeBlockStandings && (
        <BlockLeaderboard
          standings={active.activeBlockStandings}
          currentUserId={currentUserId}
          theme={theme}
        />
      )}
      {active.leaderboard.length > 0 && (
        <Leaderboard entries={active.leaderboard} />
      )}
    </>
  )
}
