'use client'

import { useEffect, useState } from 'react'

type LeaderboardEntry = {
  user_id: string
  username: string
  avatar_url: string | null
  round_wins: number
  round_points: number
  block_wins: number
  block_points: number
}

type Props = {
  gameId: number
}

export default function Leaderboard({ gameId }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/games/${gameId}/leaderboard`)
      .then((r) => r.json())
      .then((data) => setEntries(data.leaderboard ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [gameId])

  if (loading) return null
  if (entries.length === 0) return null

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

      <div style={{
        background: '#FDFAF5', border: '1px solid #E8E0D3',
        borderRadius: 2, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 56px 64px 56px 64px',
          padding: '8px 12px',
          borderBottom: '1px solid #E8E0D3',
          gap: 4,
        }}>
          {['#', '', 'R. sejr', 'R. point', 'B. sejr', 'B. point'].map((h, i) => (
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
              gridTemplateColumns: '32px 1fr 56px 64px 56px 64px',
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
            }}>
              {entry.username}
            </span>

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 600,
              color: entry.round_wins > 0 ? '#B8963E' : '#ccc',
              textAlign: 'right',
            }}>
              {entry.round_wins > 0 ? entry.round_wins : '-'}
            </span>

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 600,
              color: entry.round_points > 0 ? '#1a1a1a' : '#ccc',
              textAlign: 'right',
            }}>
              {entry.round_points > 0 ? entry.round_points : '-'}
            </span>

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 600,
              color: entry.block_wins > 0 ? '#B8963E' : '#ccc',
              textAlign: 'right',
            }}>
              {entry.block_wins > 0 ? entry.block_wins : '-'}
            </span>

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
