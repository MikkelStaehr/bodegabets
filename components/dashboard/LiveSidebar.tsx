'use client'

import { useMemo } from 'react'
import { useLiveMatchesForUser } from '@/hooks/useLiveMatches'
import { LiveMatchesTicker } from '@/components/LiveMatchesTicker'
import type { SportType } from './DashboardContent'

type Round = {
  id: number
  name: string
  matches_count: number
}

function inferSport(leagueName: string | null): SportType {
  if (!leagueName) return 'football'
  const lower = leagueName.toLowerCase()
  if (lower.includes('tour de france') || lower.includes('giro') || lower.includes('vuelta') || lower.includes('cykling') || lower.includes('cycling')) {
    return 'cycling'
  }
  return 'football'
}

export default function LiveSidebar({
  rounds,
  nextRoundDate,
  sportFilter,
}: {
  rounds: Round[]
  nextRoundDate?: string | null
  sportFilter?: 'all' | SportType
}) {
  const { items, lastUpdate } = useLiveMatchesForUser(true)

  const filteredItems = useMemo(() => {
    if (!sportFilter || sportFilter === 'all') return items
    return items.filter((item) => inferSport(item.leagueName) === sportFilter)
  }, [items, sportFilter])

  const uniqueMatches = useMemo(() => {
    const seen = new Set<number>()
    const out: typeof filteredItems[0] extends undefined ? never[] : typeof filteredItems[0]['matches'] = []
    for (const item of filteredItems) {
      for (const m of item.matches) {
        if (!seen.has(m.id)) {
          seen.add(m.id)
          out.push(m)
        }
      }
    }
    return out.sort((a, b) => (a.kickoff_at ?? '').localeCompare(b.kickoff_at ?? ''))
  }, [filteredItems])

  const summary = useMemo(() => ({
    live: uniqueMatches.filter((m) => m.status === 'live').length,
    halftime: uniqueMatches.filter((m) => m.status === 'halftime').length,
    finished: uniqueMatches.filter((m) => m.status === 'finished').length,
    scheduled: uniqueMatches.filter((m) => m.status === 'scheduled').length,
    total: uniqueMatches.length,
  }), [uniqueMatches])

  if (uniqueMatches.length === 0) {
    return (
      <div>
        <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">Live lige nu</h2>
        <div className="bg-white rounded-2xl border border-black/8 px-5 py-5 text-center">
          <p className="text-[13px] text-[#7a7060]">
            {sportFilter && sportFilter !== 'all'
              ? `Ingen aktive ${sportFilter === 'football' ? 'fodbold' : 'cykling'}kampe`
              : nextRoundDate
                ? `Ingen kampe i dag · næste runde starter ${nextRoundDate}`
                : 'Ingen aktive kampe'}
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
