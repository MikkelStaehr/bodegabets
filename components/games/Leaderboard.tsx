'use client'

import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from '@/lib/gameState'

type Props = {
  /** Hvis entries er givet, render dem direkte (ingen fetch). Ellers fetch én gang. */
  entries?: LeaderboardEntry[]
  /** Bruges kun hvis entries ikke er givet. */
  gameId?: number
  /** Compact-mode: kun rank + navn + B.point (til smal sidebar). Skjuler
   *  R.sejr/R.point/B.sejr-kolonnerne så navn-kolonnen har plads. */
  compact?: boolean
}

export default function Leaderboard({ entries: entriesProp, gameId, compact }: Props) {
  const [fetchedEntries, setFetchedEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(entriesProp === undefined)

  const entries = entriesProp ?? fetchedEntries

  useEffect(() => {
    if (entriesProp !== undefined) return
    if (!gameId) return
    fetch(`/api/games/${gameId}/leaderboard`)
      .then((r) => r.json())
      .then((data) => setFetchedEntries(data.leaderboard ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [gameId, entriesProp])

  if (loading) return null

  // Empty state KUN hvis ingen spillere overhovedet. Når der er medlemmer men
  // ingen point endnu (sæson ikke startet), viser vi alligevel deltagerlisten
  // så folk kan se hvem der er med — med en lille note øverst.
  const hasAnyScore = entries.some((e) => e.block_points > 0 || e.round_points > 0)

  if (entries.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 10 }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#6b6b6b',
          }}>
            Leaderboard
          </span>
        </div>
        <div
          style={{
            background: '#FDFAF5', border: '1px dashed #C8BEA8',
            borderRadius: 2, padding: '32px 16px', textAlign: 'center',
          }}
        >
          <p style={{
            fontFamily: "'Barlow', sans-serif", fontSize: 13,
            color: '#9E9486', lineHeight: 1.5, margin: 0,
          }}>
            Ingen spillere endnu
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: '#6b6b6b',
        }}>
          Leaderboard
        </span>
        {!hasAnyScore && (
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#9E9486',
            fontStyle: 'italic',
          }}>
            Konkurrencen starter snart
          </span>
        )}
      </div>

      <div style={{
        background: '#FDFAF5', border: '1px solid #E8E0D3',
        borderRadius: 2, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact ? '24px minmax(0, 1fr) 56px' : '32px 1fr 56px 64px 56px 64px',
          padding: '8px 12px',
          borderBottom: '1px solid #E8E0D3',
          gap: 4,
        }}>
          {(compact ? ['#', '', 'Point'] : ['#', '', 'R. sejr', 'R. point', 'B. sejr', 'B. point']).map((h, i) => (
            <span key={i} style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#9E9486',
              textAlign: i >= 2 ? 'right' : 'left',
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {entries.map((entry, idx) => (
          <div
            key={entry.user_id}
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '24px minmax(0, 1fr) 56px' : '32px 1fr 56px 64px 56px 64px',
              padding: '10px 12px',
              borderBottom: idx < entries.length - 1 ? '1px solid #E8E0D3' : 'none',
              gap: 4,
              alignItems: 'center',
              background: idx === 0 && entry.block_points > 0 ? '#F8F5ED' : 'transparent',
            }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 14, fontWeight: 700,
              color: idx === 0 ? '#B8963E' : idx === 1 ? '#7A7A7A' : idx === 2 ? '#A0785A' : '#9E9486',
            }}>
              {idx + 1}
            </span>

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 13, fontWeight: 600,
              color: '#1a1a1a',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              minWidth: 0,
            }}>
              {entry.username}
            </span>

            {!compact && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12, fontWeight: 600,
                color: entry.round_wins > 0 ? '#B8963E' : '#ccc',
                textAlign: 'right',
              }}>
                {entry.round_wins > 0 ? entry.round_wins : '-'}
              </span>
            )}

            {!compact && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12, fontWeight: 600,
                color: entry.round_points > 0 ? '#1a1a1a' : '#ccc',
                textAlign: 'right',
              }}>
                {entry.round_points > 0 ? entry.round_points : '-'}
              </span>
            )}

            {!compact && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12, fontWeight: 600,
                color: entry.block_wins > 0 ? '#B8963E' : '#ccc',
                textAlign: 'right',
              }}>
                {entry.block_wins > 0 ? entry.block_wins : '-'}
              </span>
            )}

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 13, fontWeight: 700,
              color: entry.block_points > 0 ? '#1a1a1a' : '#ccc',
              textAlign: 'right',
            }}>
              {entry.block_points > 0 ? entry.block_points : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
