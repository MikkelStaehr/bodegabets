'use client'

import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from '@/lib/gameState'
import { getTaunt, shouldTaunt } from '@/lib/zeroPointTaunt'
import PlayerHistoryModal from './PlayerHistoryModal'

type Props = {
  /** Hvis entries er givet, render dem direkte (ingen fetch). Ellers fetch én gang. */
  entries?: LeaderboardEntry[]
  /** Bruges kun hvis entries ikke er givet. */
  gameId?: number
  /** Compact-mode: kun rank + navn + Samlet/profit (til smal sidebar). */
  compact?: boolean
  /** Overskrift (default "Leaderboard"). Fx "Samlet stilling". */
  title?: string
  /** Lille undertekst under titlen, fx hvad der afgør stillingen. */
  subtitle?: string
  /** Hvis sat: rækker er klikbare og åbner spillerens drill-down-historik. */
  drillDownGameId?: number
}

const fmtProfit = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export default function Leaderboard({ entries: entriesProp, gameId, compact, title = 'Leaderboard', subtitle, drillDownGameId }: Props) {
  const [fetchedEntries, setFetchedEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(entriesProp === undefined)
  const [selected, setSelected] = useState<{ userId: string; username: string } | null>(null)

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
  // Bruges af zero-point taunten — vi vil kun mocke folk hvis runden faktisk
  // ER scoret (nogen har > 0). Ellers er alle bare ikke kommet i gang endnu.
  const allRoundPoints = entries.map((e) => e.round_points)

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
    <>
    <div>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: '#6b6b6b',
        }}>
          {title}
          {subtitle && (
            <span style={{ letterSpacing: '0.06em', color: '#9E9486', fontWeight: 400, textTransform: 'none' }}>
              {'  ·  '}{subtitle}
            </span>
          )}
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

      <div style={{ overflowX: compact ? 'visible' : 'auto' }}>
      <div style={{
        background: '#FDFAF5', border: '1px solid #E8E0D3',
        borderRadius: 2, overflow: 'hidden',
        minWidth: compact ? undefined : 480,
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact ? '24px minmax(0, 1fr) 76px' : '38px minmax(110px, 1fr) 44px 44px 78px 80px 64px',
          padding: compact ? '8px 12px' : '11px 16px',
          borderBottom: '1px solid #E8E0D3',
          gap: 4,
        }}>
          {(compact ? ['#', '', 'Samlet'] : ['#', 'Spiller', '✓', '✗', 'Samlet', 'Profit', 'Blokke']).map((h, i) => (
            <span key={i} style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: compact ? 9 : 10, fontWeight: 700,
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
            onClick={drillDownGameId ? () => setSelected({ userId: entry.user_id, username: entry.username }) : undefined}
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '24px minmax(0, 1fr) 76px' : '38px minmax(110px, 1fr) 44px 44px 78px 80px 64px',
              padding: compact ? '10px 12px' : '13px 16px',
              borderBottom: idx < entries.length - 1 ? '1px solid #E8E0D3' : 'none',
              gap: 4,
              alignItems: 'center',
              background: idx === 0 && entry.total_points > 0 ? '#F8F5ED' : 'transparent',
              cursor: drillDownGameId ? 'pointer' : 'default',
            }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: compact ? 14 : 20, fontWeight: 700,
              color: idx === 0 ? '#B8963E' : idx === 1 ? '#7A7A7A' : idx === 2 ? '#A0785A' : '#9E9486',
            }}>
              {idx + 1}
            </span>

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: compact ? 13 : 16, fontWeight: 600,
              color: '#1a1a1a',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              minWidth: 0,
            }}>
              {entry.username}
              {compact && entry.block_wins > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#B8963E' }}>
                  🏅{entry.block_wins}
                </span>
              )}
              {!compact && entry.won_latest_block && (
                <span title="Vinder af seneste blok" style={{ marginLeft: 6, fontSize: 15 }}>
                  🏅
                </span>
              )}
              {entry.mvp_count > 0 && (
                <span style={{ marginLeft: 5, fontSize: compact ? 11 : 13, fontWeight: 700, color: '#7a7060' }}>
                  🧸{entry.mvp_count}
                </span>
              )}
              {shouldTaunt(entry.round_points, allRoundPoints) && (
                <span style={{
                  fontStyle: 'italic', fontWeight: 400, color: '#9E9486',
                  marginLeft: 6, fontSize: compact ? 11 : 12,
                }}>
                  {getTaunt(`${entry.user_id}:round`)}
                </span>
              )}
            </span>

            {compact ? (
              <div style={{ textAlign: 'right', lineHeight: 1.05 }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 800,
                  color: entry.total_points > 0 ? '#1a1a1a' : '#ccc',
                }}>
                  {entry.total_points > 0 ? entry.total_points : '-'}
                </div>
                {entry.net_profit !== 0 && (
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
                    color: entry.net_profit >= 0 ? '#2C4A3E' : '#C8392B',
                  }}>
                    {fmtProfit(entry.net_profit)}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ✓ vundne */}
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
                  color: entry.won_bets > 0 ? '#2C4A3E' : '#ccc', textAlign: 'right',
                }}>
                  {entry.won_bets > 0 ? entry.won_bets : '-'}
                </span>
                {/* ✗ tabte */}
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
                  color: entry.lost_bets > 0 ? '#C8392B' : '#ccc', textAlign: 'right',
                }}>
                  {entry.lost_bets > 0 ? entry.lost_bets : '-'}
                </span>
                {/* Samlet */}
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 800,
                  color: entry.total_points > 0 ? '#1a1a1a' : '#ccc', textAlign: 'right',
                }}>
                  {entry.total_points > 0 ? entry.total_points : '-'}
                </span>
                {/* Profit (total) */}
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700,
                  color: entry.net_profit > 0 ? '#2C4A3E' : entry.net_profit < 0 ? '#C8392B' : '#ccc',
                  textAlign: 'right',
                }}>
                  {entry.net_profit !== 0 ? fmtProfit(entry.net_profit) : '-'}
                </span>
                {/* Blokke vundet — hvem fører turneringen — yderst til højre */}
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800,
                  color: entry.block_wins > 0 ? '#B8963E' : '#ccc', textAlign: 'right',
                }}>
                  {entry.block_wins > 0 ? entry.block_wins : '-'}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
    {selected && drillDownGameId && (
      <PlayerHistoryModal
        gameId={drillDownGameId}
        userId={selected.userId}
        username={selected.username}
        onClose={() => setSelected(null)}
      />
    )}
    </>
  )
}
