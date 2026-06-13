import type { BlockWinnerRow } from '@/lib/gameState'

/**
 * Historik over afgjorte blokke + hvem der vandt hver. Server-renderet
 * (data fra getBlockWinners). Vises kun når mindst én blok er afgjort.
 */
export default function BlockWinnersHistory({ blocks }: { blocks: BlockWinnerRow[] }) {
  if (!blocks || blocks.length === 0) return null

  return (
    <div>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#6b6b6b', marginBottom: 10,
      }}>
        🏅 Afgjorte blokke
      </p>
      <div style={{ background: '#FDFAF5', border: '1px solid #C8BEA8', borderRadius: 2, overflow: 'hidden' }}>
        {blocks.map((b, idx) => (
          <div
            key={b.block_number}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderBottom: idx < blocks.length - 1 ? '1px solid #E8E0D3' : 'none',
            }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9E9486',
              minWidth: 48,
            }}>
              Blok {b.block_number}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {b.winners.length === 0 ? (
                <span style={{ fontSize: 12, color: '#9E9486' }}>—</span>
              ) : (
                <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 600 }}>
                  🏅 {b.winners.map((w) => w.username).join(' & ')}
                </span>
              )}
            </div>
            {b.winners.length > 0 && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#B8963E',
              }}>
                {b.winners[0].points_in_block}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
