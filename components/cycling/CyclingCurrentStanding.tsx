'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/gameState'

type Props = {
  gameId: number
  /** Navn på den nuværende TOP-blok (fx "Tour de France") — det aktive spil. */
  metaBlockName: string | null
  /** Navn på den aktive sub-blok/uge (fx "Uge 2") — bruges som kolonne-overskrift. */
  subBlockName: string | null
  /** Status på den aktive blok — "Fører" (active) vs "Vinder" (finished). */
  blockStatus?: 'upcoming' | 'active' | 'finished' | null
  embedded?: boolean
}

/**
 * Stilling for det NUVÆRENDE spil (den aktive top-blok, fx Tour de France).
 * Viser tre granulariteter pr. spiller så man kan følge det aktive løb uden at
 * skifte til sæson-fanen:
 *   - Meta blok  → point i HELE det nuværende løb (alle uger)
 *   - Summeret   → sæson-total på tværs af alle løb
 *   - Blok       → point i den aktive uge/sub-blok (fx Uge 2)
 *
 * Sorteres efter meta-blok-point (det aktive løb er fokus), med sæson-total som
 * tie-break.
 */
export default function CyclingCurrentStanding({ gameId, metaBlockName, subBlockName, blockStatus, embedded }: Props) {
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

  const ranked = [...entries].sort((a, b) =>
    (b.meta_block_points ?? 0) - (a.meta_block_points ?? 0)
    || (b.total_points ?? 0) - (a.total_points ?? 0),
  )
  const hasPoints = ranked.some((e) => (e.meta_block_points ?? 0) > 0 || (e.total_points ?? 0) > 0)
  // Vis kun sub-blok som separat kontekst/kolonne hvis den adskiller sig fra
  // top-blokken (klassikere uden uger har sub == top → undgå dobbelt-navn).
  const hasSub = !!subBlockName && subBlockName !== metaBlockName
  const blokLabel = hasSub ? subBlockName! : 'Blok'

  return (
    <div className={embedded ? 'px-4 sm:px-5 py-3' : 'bg-cream-dark border border-warm-border rounded-sm p-4 sm:p-5'}>
      {/* Kontekst-linje: hvilket løb + uge vi ser */}
      <p className="font-condensed text-[11px] uppercase tracking-[0.08em] text-warm-gray mb-2">
        {metaBlockName ?? 'Aktivt løb'}
        {hasSub && <span className="text-warm-taupe"> — {subBlockName}</span>}
        {!hasPoints && <span className="ml-2">— ingen point endnu</span>}
      </p>

      {hasPoints && (
        <div>
          {/* Header */}
          <div className="grid grid-cols-[22px_1fr_52px_52px_52px] gap-2 items-end pb-2 mb-1 border-b border-warm-border/60">
            <span />
            <span className="font-condensed text-[10px] font-bold uppercase tracking-[0.06em] text-warm-gray">Spiller</span>
            <span
              className="font-condensed text-[10px] font-bold uppercase tracking-[0.04em] text-warm-gray text-right"
              title={`Point i hele ${metaBlockName ?? 'løbet'}`}
            >
              Meta
            </span>
            <span
              className="font-condensed text-[10px] font-bold uppercase tracking-[0.04em] text-warm-gray text-right"
              title="Sammenlagt point — alle løb i sæsonen"
            >
              Sum
            </span>
            <span
              className="font-condensed text-[10px] font-bold uppercase tracking-[0.04em] text-warm-gray text-right truncate"
              title={`Point i ${subBlockName ?? 'den aktive uge'}`}
            >
              {blokLabel}
            </span>
          </div>

          {ranked.map((entry, idx) => {
            const meta = entry.meta_block_points ?? 0
            const sum = entry.total_points ?? 0
            const blok = entry.block_points ?? 0
            const isTop1 = idx === 0 && meta > 0
            const isFinished = blockStatus === 'finished'
            return (
              <div
                key={entry.user_id}
                className="grid grid-cols-[22px_1fr_52px_52px_52px] gap-2 items-center py-2"
                style={{ borderBottom: idx < ranked.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
              >
                <span className={`stat-number text-base ${idx === 0 ? 'text-gold-dark' : 'text-warm-gray'}`}>
                  {idx + 1}
                </span>
                <span className="min-w-0 flex items-center gap-2">
                  <span className="font-condensed font-semibold text-sm text-ink truncate">
                    {entry.username}
                  </span>
                  {isTop1 && (
                    <span
                      className="font-condensed text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1"
                      style={{
                        background: 'rgba(184,150,62,0.15)',
                        color: '#8B6F1F',
                        border: '1px solid rgba(184,150,62,0.35)',
                      }}
                    >
                      {isFinished && <Trophy size={9} strokeWidth={2.6} />}
                      {isFinished ? 'Vinder' : 'Fører'}
                    </span>
                  )}
                </span>
                {/* Meta blok — primær kolonne */}
                <span className={`stat-number text-base text-right ${meta > 0 ? 'text-ink font-semibold' : 'text-warm-gray'}`}>
                  {meta > 0 ? Math.round(meta * 10) / 10 : '—'}
                </span>
                {/* Summeret — sekundær */}
                <span className={`stat-number text-sm text-right ${sum > 0 ? 'text-warm-taupe' : 'text-warm-gray'}`}>
                  {sum > 0 ? Math.round(sum * 10) / 10 : '—'}
                </span>
                {/* Blok (aktiv uge) — sekundær */}
                <span className={`stat-number text-sm text-right ${blok > 0 ? 'text-warm-taupe' : 'text-warm-gray'}`}>
                  {blok > 0 ? Math.round(blok * 10) / 10 : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
