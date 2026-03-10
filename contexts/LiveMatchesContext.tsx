'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useLiveMatches } from '@/hooks/useLiveMatches'
import type { LiveMatch, LiveSummary } from '@/hooks/useLiveMatches'

type LiveMatchesContextValue = {
  matches: LiveMatch[]
  summary: LiveSummary
  lastUpdate: Date | null
}

const LiveMatchesContext = createContext<LiveMatchesContextValue | null>(null)

export function useLiveMatchesContext() {
  return useContext(LiveMatchesContext)
}

export function LiveMatchesProvider({
  roundId,
  enabled,
  children,
}: {
  roundId: number | null
  enabled: boolean
  children: ReactNode
}) {
  const { matches, summary, lastUpdate } = useLiveMatches(roundId, enabled)
  const value: LiveMatchesContextValue = { matches, summary, lastUpdate }
  return (
    <LiveMatchesContext.Provider value={value}>
      {children}
    </LiveMatchesContext.Provider>
  )
}
