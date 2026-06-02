'use client'

import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from '@/lib/gameState'

type Props = {
  gameId: number
  /** Navn på den aktive blok (vises i overskriften). */
  blockName: string | null
  /** Status på den aktive blok — styrer "Fører" (active) vs "Vinder" (finished). */
  blockStatus?: 'upcoming' | 'active' | 'finished' | null
}

/**
 * Per-blok stilling: viser spillerne sorteret efter point i den aktive blok
 * (`block_points` på LeaderboardEntry). Bruges som supplement til den globale
 * Leaderboard, så man kan se "hvem fører i Giroen lige nu" uden at skulle
 * gætte fra de samlede earnings.
 *
 * Top-1 markeres med en label:
 *   - active blok → "Fører" (gylden, spændingen er live)
 *   - finished blok → "Vinder" (gylden + trofæ-ikon, blokken er afsluttet)
 */
export default function CyclingBlockStanding({ gameId, blockName, blockStatus }: Props) {
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

  const ranked = [...entries].sort((a, b) => (b.block_points ?? 0) - (a.block_points ?? 0))
  const hasPoints = ranked.some((e) => (e.block_points ?? 0) > 0)

  return (
    <div className="bg-cream-dark border border-warm-border rounded-sm p-4 sm:p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="label-caps text-warm-taupe">
          {(blockName ?? 'Aktiv blok')} <span className="text-warm-gray normal-case tracking-normal">— stilling</span>
        </p>
        {!hasPoints && (
          <p className="font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray">Ingen point endnu</p>
        )}
      </div>

      {hasPoints && (
        <div>
          {ranked.map((entry, idx) => {
            const points = entry.block_points ?? 0
            const isTop1 = idx === 0 && points > 0
            const isFinished = blockStatus === 'finished'
            return (
              <div
                key={entry.user_id}
                className="grid grid-cols-[28px_1fr_auto] gap-3 items-center py-2"
                style={{ borderBottom: idx < ranked.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
              >
                <span className={`stat-number text-base ${
                  idx === 0 ? 'text-gold-dark' : 'text-warm-gray'
                }`}>
                  {idx + 1}
                </span>
                <span className="min-w-0 flex items-center gap-2">
                  <span className="font-condensed font-semibold text-sm text-ink truncate">
                    {entry.username}
                  </span>
                  {isTop1 && (
                    <span
                      className="font-condensed text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        background: 'rgba(184,150,62,0.15)',
                        color: '#8B6F1F',
                        border: '1px solid rgba(184,150,62,0.35)',
                      }}
                    >
                      {isFinished ? 'Vinder' : 'Fører'}
                    </span>
                  )}
                </span>
                <span className={`stat-number text-base ${points > 0 ? 'text-ink' : 'text-warm-gray'}`}>
                  {points > 0 ? `${points} pt` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
