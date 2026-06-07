'use client'

import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from '@/lib/gameState'

type Props = {
  gameId: number
  /** Når true, fjernes ydre card og titel — komponenten flyder ind i en
   *  parent-container (fx CyclingRanglister tabs). */
  embedded?: boolean
}

/**
 * Sæson-overblik for et cykel-spilrum: sammenlagt point + antal blok-sejre
 * (top + sub tæller ens). Adskilt fra den nuværende blok-stilling
 * (CyclingBlockStanding) og den almindelige Leaderboard for at give spillere
 * et 'season-trophy'-overblik der ikke skifter når en ny uge eller blok starter.
 */
export default function CyclingSeasonOverview({ gameId, embedded }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/games/${gameId}/leaderboard`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setEntries(data.leaderboard ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [gameId])

  if (loading) return null

  // Sortér: flest sammenlagt point først, derefter sejre som tie-break
  const ranked = [...entries].sort((a, b) =>
    (b.total_points ?? 0) - (a.total_points ?? 0)
    || (b.block_wins ?? 0) - (a.block_wins ?? 0),
  )
  const hasAnyPoints = ranked.some((e) => (e.total_points ?? 0) > 0)

  if (!hasAnyPoints) return null

  return (
    <div className={embedded ? 'px-4 sm:px-5 py-3' : 'bg-cream-dark border border-warm-border rounded-sm p-4 sm:p-5 mb-4'}>
      {!embedded && <p className="label-caps text-warm-taupe mb-3">Sæson-overblik</p>}

      {/* Header */}
      <div className="grid grid-cols-[28px_1fr_56px_80px] gap-3 items-center pb-2 mb-1 border-b border-warm-border/60">
        <span />
        <span className="font-condensed text-[10px] font-bold uppercase tracking-[0.08em] text-warm-gray">Spiller</span>
        <span className="font-condensed text-[10px] font-bold uppercase tracking-[0.08em] text-warm-gray text-right">Sejre</span>
        <span className="font-condensed text-[10px] font-bold uppercase tracking-[0.08em] text-warm-gray text-right">Sammenlagt</span>
      </div>

      {ranked.map((entry, idx) => {
        const wins = entry.block_wins ?? 0
        const total = entry.total_points ?? 0
        return (
          <div
            key={entry.user_id}
            className="grid grid-cols-[28px_1fr_56px_80px] gap-3 items-center py-2"
            style={{ borderBottom: idx < ranked.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
          >
            <span className={`stat-number text-base ${idx === 0 ? 'text-gold-dark' : 'text-warm-gray'}`}>
              {idx + 1}
            </span>
            <span className="font-condensed font-semibold text-sm text-ink truncate">
              {entry.username}
            </span>
            <span className={`stat-number text-base text-right ${wins > 0 ? 'text-gold-dark' : 'text-warm-gray'}`}>
              {wins > 0 ? wins : '—'}
            </span>
            <span className="stat-number text-base text-right text-ink">
              {Math.round(total * 10) / 10} pt
            </span>
          </div>
        )
      })}
    </div>
  )
}
