'use client'

import { useGameStateContextOptional } from '@/hooks/useGameState'
import { LiveMatchesTicker } from '@/components/games/LiveMatchesTicker'
import type { LiveMatch, LiveSummary } from '@/hooks/useLiveMatches'

export default function ActiveRoundLiveTicker() {
  const ctx = useGameStateContextOptional()
  const matches = (ctx?.state?.matches ?? []) as unknown as LiveMatch[]
  const summary: LiveSummary = ctx?.state?.summary ?? {
    live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0, roundName: null,
  }
  const lastUpdate = ctx?.lastUpdate ?? null
  const isLoading = ctx?.isLoading ?? true

  if (isLoading) {
    return (
      <div className="bg-[#1a3329] rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex justify-between items-center border-b border-white/10">
          <div className="h-4 w-32 rounded bg-[#2C4A3E] animate-pulse" />
          <div className="h-3 w-20 rounded bg-[#2C4A3E] animate-pulse" />
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="h-3 w-24 rounded bg-[#2C4A3E] animate-pulse mx-auto" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
              <div className="h-4 rounded bg-[#2C4A3E] animate-pulse flex-1" />
              <div className="h-3 w-8 rounded bg-[#2C4A3E] animate-pulse" />
              <div className="h-4 rounded bg-[#2C4A3E] animate-pulse flex-1" />
              <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
              <div className="h-5 w-6 rounded bg-[#2C4A3E] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

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
