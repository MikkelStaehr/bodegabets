'use client'

import { useLiveMatchesForUser } from '@/hooks/useLiveMatches'
import { LiveMatchesTicker } from '@/components/LiveMatchesTicker'

type Round = {
  id: number
  name: string
  matches_count: number
}

export default function LiveSidebar({ rounds, nextRoundDate }: { rounds: Round[]; nextRoundDate?: string | null }) {
  const { items, lastUpdate } = useLiveMatchesForUser(true)

  const uniqueMatches = (() => {
    const seen = new Set<number>()
    const out: typeof items[0]['matches'] = []
    for (const item of items) {
      for (const m of item.matches) {
        if (!seen.has(m.id)) {
          seen.add(m.id)
          out.push(m)
        }
      }
    }
    return out.sort((a, b) => (a.kickoff_at ?? '').localeCompare(b.kickoff_at ?? ''))
  })()

  const summary = {
    live: uniqueMatches.filter((m) => m.status === 'live').length,
    halftime: uniqueMatches.filter((m) => m.status === 'halftime').length,
    finished: uniqueMatches.filter((m) => m.status === 'finished').length,
    total: uniqueMatches.length,
  }

  if (uniqueMatches.length === 0) {
    return (
      <div>
        <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">Live lige nu</h2>
        <div className="bg-white rounded-2xl border border-black/8 px-5 py-5 text-center">
          <p className="text-[13px] text-[#7a7060]">
            Ingen kampe i dag · {nextRoundDate ? `næste runde starter ${nextRoundDate}` : 'næste runde starter snart'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">Live lige nu</h2>
      <LiveMatchesTicker matches={uniqueMatches} summary={summary} lastUpdate={lastUpdate} />
    </div>
  )
}
