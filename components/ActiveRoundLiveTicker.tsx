'use client'

import { useLiveMatches } from '@/hooks/useLiveMatches'
import { useLiveMatchesContext } from '@/contexts/LiveMatchesContext'
import { LiveMatchesTicker } from '@/components/LiveMatchesTicker'

type Props = {
  roundId: number | null
  enabled?: boolean
}

export default function ActiveRoundLiveTicker({ roundId, enabled = true }: Props) {
  const ctx = useLiveMatchesContext()
  const hookData = useLiveMatches(roundId, enabled && !ctx)
  const { matches, summary, lastUpdate } = ctx ?? hookData

  if (matches.length === 0) return null

  return (
    <div style={{
      marginTop: 16,
      background: '#1a3329',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <LiveMatchesTicker
        matches={matches}
        summary={summary}
        lastUpdate={lastUpdate}
      />
    </div>
  )
}
