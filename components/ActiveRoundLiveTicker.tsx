'use client'

import { useLiveMatchesContext } from '@/contexts/LiveMatchesContext'
import { LiveMatchesTicker } from '@/components/LiveMatchesTicker'

export default function ActiveRoundLiveTicker() {
  const ctx = useLiveMatchesContext()
  const matches = ctx?.matches ?? []
  const summary = ctx?.summary ?? { live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0 }
  const lastUpdate = ctx?.lastUpdate ?? null

  if (matches.length === 0) return (
    <div style={{
      marginTop: 16,
      background: '#1a3329',
      borderRadius: 8,
      padding: '16px 20px',
      border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(242,237,228,0.4)',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 12,
      textAlign: 'center' as const,
    }}>
      Ingen kampe i dag
    </div>
  )

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
