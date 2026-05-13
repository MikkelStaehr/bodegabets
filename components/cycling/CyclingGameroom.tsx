'use client'

import { useState } from 'react'
import type { CyclingRace, CyclingSquadRider } from '@/types/cycling'
import { formatCyclingDeadline } from '@/lib/cyclingUtils'
import { type JerseyKey } from '@/lib/cyclingJerseys'
import JerseyIcon from './JerseyIcon'

// ── Types ───────────────────────────────────────────────────────────────────

type ActiveBlock = {
  id: string
  name: string
  block_order: number
  lock_deadline?: string | null
}

type ClassementRider = {
  rider_id: string
  first_name: string
  last_name: string
  team_name: string
  photo_url: string | null
  team_logo_url: string | null
  position: number
  time_gap_seconds?: number | null
}

type Classement = {
  raceName: string
  leader: ClassementRider | null
  pointsLeader: ClassementRider | null
  mountainLeader: ClassementRider | null
  youthLeader: ClassementRider | null
  gcTop: ClassementRider[]
  pointsTop: ClassementRider[]
  mountainTop: ClassementRider[]
  youthTop: ClassementRider[]
}

type Props = {
  gameId: number
  squadId: string | null
  activeBlock: ActiveBlock | null
  races: CyclingRace[]
  squadRiders: CyclingSquadRider[]
  classements?: Record<string, Classement>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeGap(seconds: number | null | undefined): string {
  if (seconds == null) return ''
  if (seconds === 0) return '0:00'
  const sign = seconds < 0 ? '-' : '+'
  const abs = Math.abs(seconds)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${sign}${m}:${String(s).padStart(2, '0')}`
}

function RiderRow({ rider, raceName, jersey, showTimeGap }: {
  rider: ClassementRider
  raceName: string
  jersey?: JerseyKey
  showTimeGap?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 13, fontWeight: 700,
        color: '#9E9486', width: 16, textAlign: 'right', flexShrink: 0,
      }}>
        {rider.position}
      </span>
      {rider.photo_url ? (
        <img
          src={rider.photo_url}
          alt=""
          style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#E8E0D3', flexShrink: 0,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span style={{ textTransform: 'uppercase' }}>{rider.last_name}</span>
          {' '}<span style={{ fontWeight: 400, color: '#6b6b6b' }}>{rider.first_name}</span>
        </div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, color: '#9E9486', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {rider.team_name}
        </div>
      </div>
      {showTimeGap && rider.time_gap_seconds != null && (
        <span style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11, color: rider.position === 1 ? '#1a1a1a' : '#6b6b6b',
          flexShrink: 0, fontVariantNumeric: 'tabular-nums',
        }}>
          {rider.position === 1 ? '0:00' : formatTimeGap(rider.time_gap_seconds)}
        </span>
      )}
      {jersey && (
        <JerseyIcon
          jersey={jersey}
          raceName={raceName}
          size={22}
          title={`Bærer ${jersey}-trøjen`}
        />
      )}
    </div>
  )
}

type TabKey = 'gc' | 'points' | 'mountain' | 'youth'

function ClassementCard({ classement }: { classement: Classement }) {
  const [tab, setTab] = useState<TabKey>('gc')

  const tabs: Array<{ key: TabKey; label: string; jersey: JerseyKey; available: boolean }> = [
    { key: 'gc', label: 'GC', jersey: 'leader', available: classement.gcTop.length > 0 },
    { key: 'points', label: 'Points', jersey: 'points', available: classement.pointsTop.length > 0 },
    { key: 'mountain', label: 'Bjerg', jersey: 'mountain', available: classement.mountainTop.length > 0 },
    { key: 'youth', label: 'Ung', jersey: 'youth', available: classement.youthTop.length > 0 },
  ]

  const jerseys = [
    { key: 'leader' as JerseyKey, rider: classement.leader },
    { key: 'points' as JerseyKey, rider: classement.pointsLeader },
    { key: 'mountain' as JerseyKey, rider: classement.mountainLeader },
    { key: 'youth' as JerseyKey, rider: classement.youthLeader },
  ].filter((j) => j.rider)

  const activeTop = tab === 'gc' ? classement.gcTop
    : tab === 'points' ? classement.pointsTop
    : tab === 'mountain' ? classement.mountainTop
    : classement.youthTop

  return (
    <div
      style={{
        padding: '16px',
        background: '#FDFAF5',
        border: '1px solid #E8E0D3',
        borderRadius: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#9E9486', fontWeight: 600,
        }}>
          Klassement
        </span>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 12, fontWeight: 700, color: '#1a1a1a',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {classement.raceName}
        </span>
      </div>

      {/* Trøje-bærere */}
      {jerseys.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {jerseys.map((j) => (
            <RiderRow
              key={j.key}
              rider={j.rider!}
              raceName={classement.raceName}
              jersey={j.key}
            />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid #E8E0D3',
        marginBottom: 12,
      }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => t.available && setTab(t.key)}
            disabled={!t.available}
            style={{
              flex: 1, padding: '8px 4px',
              background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? '2px solid #1a1a1a' : '2px solid transparent',
              marginBottom: -1,
              cursor: t.available ? 'pointer' : 'not-allowed',
              opacity: t.available ? 1 : 0.35,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: tab === t.key ? '#1a1a1a' : '#9E9486',
            }}
          >
            <JerseyIcon jersey={t.jersey} raceName={classement.raceName} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Top-10 liste */}
      {activeTop.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeTop.map((rider) => (
            <RiderRow
              key={rider.rider_id}
              rider={rider}
              raceName={classement.raceName}
              showTimeGap={tab === 'gc'}
            />
          ))}
        </div>
      ) : (
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: '#9E9486', textAlign: 'center', padding: '12px 0' }}>
          Ingen data endnu
        </p>
      )}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CyclingGameroom({ activeBlock, races, classements }: Props) {
  const classementsList = Object.values(classements ?? {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Klassement-kort ──────────────────────────────────────── */}
      {classementsList.length > 0 ? (
        classementsList.map((c) => (
          <ClassementCard key={c.raceName} classement={c} />
        ))
      ) : (
        <div
          style={{
            padding: '16px',
            background: '#FDFAF5',
            border: '1px solid #E8E0D3',
            borderRadius: 2,
          }}
        >
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9E9486', fontWeight: 600 }}>
            Klassement
          </span>
          <p style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 12, color: '#9E9486',
            lineHeight: 1.4, marginTop: 4,
          }}>
            Kommer når første etape er kørt
          </p>
        </div>
      )}

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
