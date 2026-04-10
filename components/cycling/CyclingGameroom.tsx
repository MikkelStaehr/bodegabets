'use client'

import type { CyclingRace, CyclingSquadRider } from '@/types/cycling'
import { formatCyclingDeadline } from '@/lib/cyclingUtils'

// ── Types ───────────────────────────────────────────────────────────────────

type ActiveBlock = {
  id: string
  name: string
  block_order: number
  lock_deadline?: string | null
}

type Props = {
  gameId: number
  squadId: string | null
  activeBlock: ActiveBlock | null
  races: CyclingRace[]
  squadRiders: CyclingSquadRider[]
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CyclingGameroom({ activeBlock, races }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Live feed kort ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          background: '#FDFAF5',
          border: '1px solid #E8E0D3',
          borderRadius: 2,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
            Live feed
          </span>
          <p style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 12,
            color: '#9E9486',
            lineHeight: 1.4,
            marginTop: 4,
          }}>
            Kommer snart
          </p>
        </div>
      </div>

      {/* ── Aktiv lineup label ────────────────────────────────────── */}
      {races.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#6b6b6b',
          }}>
            Aktiv lineup
          </span>
          {activeBlock && (
            <span style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: '#E6F1FB',
              color: '#0C447C',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10,
              fontWeight: 700,
            }}>
              {activeBlock.name}
            </span>
          )}
          {activeBlock?.lock_deadline && (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10,
              color: '#C8392B',
              fontWeight: 600,
              marginLeft: 'auto',
            }}>
              Låser {formatCyclingDeadline(activeBlock.lock_deadline)}
            </span>
          )}
        </div>
      )}

    </div>
  )
}
