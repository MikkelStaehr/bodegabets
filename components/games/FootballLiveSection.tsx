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
  /** Når 'main' (default): viser BlockLeaderboard + Leaderboard.
   *  'main-no-leaderboard': kun BlockLeaderboard (til 3-col layout).
   *  'sidebar': kun compact Leaderboard (til sidebar i 3-col layout). */
  variant?: 'main' | 'main-no-leaderboard' | 'sidebar'
  /** Navn på den aktive runde — vises som kontekst i blok-stillingen. */
  currentRoundName?: string
}

/**
 * Live fodbold-sektion: poller /api/games/[id]/state og renderer
 * block-leaderboard + fælles leaderboard med altid-friske data.
 *
 * I 3-kolonne desktop-layout split'er vi i to:
 *   - variant='main-no-leaderboard' renderer kun BlockLeaderboard i main
 *   - variant='sidebar' renderer kun Leaderboard compact i højre sidebar
 *
 * Begge variants har deres egen useGameState — let polling-overhead, men
 * undgår behov for prop-drilling eller delt context.
 */
export default function FootballLiveSection({
  gameId,
  currentUserId,
  initialState,
  theme,
  variant = 'main',
  currentRoundName,
}: Props) {
  const { state } = useGameState(gameId, { initialState })
  const active = state ?? initialState

  // Sidebar: intet ekstra — leaderboardet (m. MoM- og Blokke-kolonner) ligger i main.
  if (variant === 'sidebar') {
    return null
  }

  // Main: det STORE leaderboard er centrum — overblik over hele spillet — efterfulgt
  // af den aktive bloks stilling.
  return (
    <>
      {active.leaderboard.length > 0 && (
        <Leaderboard
          entries={active.leaderboard}
          title="Stilling"
          subtitle="tryk på en spiller for fuld historik"
          drillDownGameId={gameId}
        />
      )}
      {active.activeBlockStandings && (
        <BlockLeaderboard
          standings={active.activeBlockStandings}
          currentUserId={currentUserId}
          theme={theme}
          currentRoundName={currentRoundName}
        />
      )}
    </>
  )
}
