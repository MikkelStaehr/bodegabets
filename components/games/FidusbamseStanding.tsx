'use client'

import type { LeaderboardEntry } from '@/lib/gameState'

/**
 * 🧸 Fidusbamsen — sidekonkurrence: hvem har taget flest "Man of the Match"
 * (flest point i en spillerunde). Afledt af leaderboard-entries (mvp_count),
 * så ingen ekstra fetch. Vises kun når mindst én bamse er uddelt.
 */
export default function FidusbamseStanding({ entries }: { entries: LeaderboardEntry[] }) {
  const ranked = entries.filter((e) => e.mvp_count > 0).sort((a, b) => b.mvp_count - a.mvp_count)
  if (ranked.length === 0) return null

  return (
    <div>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#6b6b6b', marginBottom: 2,
      }}>
        🧸 Fidusbamsen
      </p>
      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: '#9E9486', marginBottom: 10 }}>
        Flest point i en spillerunde
      </p>
      <div style={{ background: '#FDFAF5', border: '1px solid #C8BEA8', borderRadius: 2, overflow: 'hidden' }}>
        {ranked.map((e, idx) => (
          <div
            key={e.user_id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              borderBottom: idx < ranked.length - 1 ? '1px solid #E8E0D3' : 'none',
              background: idx === 0 ? '#F8F5ED' : 'transparent',
            }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
              color: idx === 0 ? '#B8963E' : '#9E9486', minWidth: 16,
            }}>
              {idx + 1}
            </span>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#1a1a1a',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {e.username}
            </span>
            <span style={{ fontSize: 13, letterSpacing: '-1px' }}>
              {'🧸'.repeat(Math.min(e.mvp_count, 5))}
            </span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
              color: '#7a7060', minWidth: 16, textAlign: 'right',
            }}>
              {e.mvp_count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
