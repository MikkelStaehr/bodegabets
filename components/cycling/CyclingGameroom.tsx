'use client'

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
  gc_position: number | null
}

type Classement = {
  raceName: string
  leader: ClassementRider | null
  points: ClassementRider | null
  mountain: ClassementRider | null
  youth: ClassementRider | null
  gcTop5: ClassementRider[]
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

function RiderRow({ rider, raceName, jersey, position }: {
  rider: ClassementRider
  raceName: string
  jersey?: JerseyKey
  position?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {position != null && (
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 13, fontWeight: 700,
          color: '#9E9486', width: 16, textAlign: 'right',
        }}>
          {position}
        </span>
      )}
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
      {jersey && (
        <JerseyIcon
          jersey={jersey}
          raceName={raceName}
          size={24}
          title={`Bærer ${jersey}-trøjen`}
        />
      )}
    </div>
  )
}

function ClassementCard({ classement }: { classement: Classement }) {
  const jerseys = [
    { key: 'leader' as JerseyKey, rider: classement.leader },
    { key: 'points' as JerseyKey, rider: classement.points },
    { key: 'mountain' as JerseyKey, rider: classement.mountain },
    { key: 'youth' as JerseyKey, rider: classement.youth },
  ].filter((j) => j.rider)

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

      {/* Jersey-bærere */}
      {jerseys.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: classement.gcTop5.length > 0 ? 12 : 0 }}>
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

      {/* GC top-5 */}
      {classement.gcTop5.length > 0 && (
        <>
          <div style={{ borderTop: '1px dashed #E8E0D3', paddingTop: 12 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#9E9486', fontWeight: 600, marginBottom: 8,
            }}>
              GC top 5
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {classement.gcTop5.map((rider) => (
                <RiderRow
                  key={rider.rider_id}
                  rider={rider}
                  raceName={classement.raceName}
                  position={rider.gc_position ?? undefined}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CyclingGameroom({ activeBlock, races, classements }: Props) {
  // Find klassementer for racer i den aktive blok (eller første tilgængelige).
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
