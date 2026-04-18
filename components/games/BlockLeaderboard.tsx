'use client'

import type { ActiveBlockStandings } from '@/lib/gameState'

type Theme = {
  primary: string
  primaryLight: string
}

type Props = {
  standings: ActiveBlockStandings
  currentUserId: string
  theme: Theme
}

/**
 * Blok-stilling for aktiv blok. Data kommer fra useGameState via parent,
 * så rows opdateres live efter hver kamp færdiggøres.
 */
export default function BlockLeaderboard({ standings, currentUserId, theme }: Props) {
  if (!standings || standings.rows.length === 0) return null

  const { block_name, rounds_remaining, rows } = standings

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: '#6b6b6b',
        }}>
          {block_name}
        </span>
        {rounds_remaining > 0 && (
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, color: '#9E9486',
          }}>
            {rounds_remaining} runde{rounds_remaining !== 1 ? 'r' : ''} tilbage
          </span>
        )}
      </div>
      <div style={{
        background: '#FDFAF5', border: '1px solid #C8BEA8',
        borderRadius: 2, overflow: 'hidden',
      }}>
        {rows.slice(0, 5).map((entry, idx) => {
          const isMe = entry.user_id === currentUserId
          return (
            <div
              key={entry.user_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr 60px',
                padding: '8px 12px',
                borderBottom: idx < Math.min(rows.length, 5) - 1 ? '1px solid #E8E0D3' : 'none',
                gap: 8,
                alignItems: 'center',
                background: isMe ? `${theme.primary}0D` : undefined,
              }}
            >
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12, fontWeight: 700, textAlign: 'center',
                color: entry.rank <= 3 ? '#B8963E' : '#6b6b6b',
              }}>
                {entry.rank}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isMe ? theme.primaryLight : theme.primary,
                  color: '#F2EDE4',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {entry.username.slice(0, 2).toUpperCase()}
                </div>
                <span style={{
                  fontSize: 13, color: '#1a1a1a',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.username}
                  {isMe && (
                    <span style={{ fontSize: 11, color: '#6b6b6b', fontWeight: 300 }}> · dig</span>
                  )}
                </span>
              </div>
              <div style={{
                textAlign: 'right',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 15, fontWeight: 700, color: '#1a1a1a',
              }}>
                {entry.total >= 0 ? `+${entry.total}` : entry.total.toLocaleString('da-DK')}
              </div>
            </div>
          )
        })}
      </div>
      {rows.length > 5 && (
        <p style={{
          fontSize: 11, color: '#9E9486', textAlign: 'center',
          padding: '8px 0 0', fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          +{rows.length - 5} flere spillere
        </p>
      )}
    </div>
  )
}
