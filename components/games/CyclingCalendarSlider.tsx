'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

export type CyclingEvent = {
  date: string
  race_name: string
  race_slug: string
  race_type: string
  stage_number: number | null
  stage_name: string | null
  profile: string
  status: string
  block_number: number
}

interface Props {
  events: CyclingEvent[]
  sportColor?: string
}

const DAY_NAMES_DA = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const MONTH_NAMES_DA = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
]

// Short display names for races
const SHORT_NAMES: Record<string, string> = {
  'tour-de-france': 'Tour',
  'giro-d-italia': 'Giro',
  'vuelta-a-espana': 'Vuelta',
  'paris-nice': 'Paris-Nice',
  'tirreno-adriatico': 'Tirreno',
  'volta-a-catalunya': 'Catalunya',
  'itzulia-basque-country': 'Itzulia',
  'tour-de-romandie': 'Romandie',
  'tour-de-suisse': 'Suisse',
  'dauphine': 'Dauphiné',
  'milano-sanremo': 'Sanremo',
  'ronde-van-vlaanderen': 'Flandern',
  'paris-roubaix': 'Roubaix',
  'liege-bastogne-liege': 'Liège',
  'il-lombardia': 'Lombardia',
  'omloop-het-nieuwsblad': 'Omloop',
  'strade-bianche': 'Strade',
  'e3-harelbeke': 'E3',
  'gent-wevelgem': 'Wevelgem',
  'dwars-door-vlaanderen': 'Dwars',
  'amstel-gold-race': 'Amstel',
  'la-fleche-wallonne': 'Flèche',
  'eschborn-frankfurt': 'Frankfurt',
  'san-sebastian': 'San Seb.',
  'bretagne-classic': 'Bretagne',
  'gp-quebec': 'Québec',
  'gp-montreal': 'Montréal',
  'world-championship': 'VM',
  'uec-road-european-championships': 'EM',
}

// Profile icon + color
const PROFILE_STYLES: Record<string, { icon: string; color: string }> = {
  flat:     { icon: '→',  color: '#4A6FA5' },
  cobbled:  { icon: '▪▪', color: '#8B6F47' },
  hilly:    { icon: '⌒',  color: '#5A8A5A' },
  mountain: { icon: '▲',  color: '#6B6B6B' },
  mixed:    { icon: '~',  color: '#7A5FA5' },
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ProfileBadge({ profile }: { profile: string }) {
  const style = PROFILE_STYLES[profile] ?? PROFILE_STYLES.mixed
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: 2,
        background: `${style.color}20`,
        color: style.color,
        fontSize: 8,
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {style.icon}
    </span>
  )
}

export default function CyclingCalendarSlider({
  events,
  sportColor = '#1E3A5F',
}: Props) {
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CyclingEvent[]>()
    for (const e of events) {
      if (!e.date) continue
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [events])

  const today = new Date()
  const todayKey = toDateKey(today)

  const defaultDate = useMemo(() => {
    if (eventsByDate.has(todayKey)) return todayKey
    const sortedDates = [...eventsByDate.keys()].sort()
    const future = sortedDates.find((d) => d >= todayKey)
    if (future) return future
    return sortedDates[sortedDates.length - 1] ?? todayKey
  }, [eventsByDate, todayKey])

  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(defaultDate + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const selectedDayRef = useRef<HTMLButtonElement>(null)

  const daysInMonth = useMemo(() => {
    const { year, month } = viewMonth
    const count = new Date(year, month + 1, 0).getDate()
    const days: Array<{
      key: string
      dayName: string
      dayNum: number
      isPast: boolean
      isToday: boolean
      hasEvents: boolean
      events: CyclingEvent[]
    }> = []

    for (let i = 1; i <= count; i++) {
      const d = new Date(year, month, i)
      const key = toDateKey(d)
      const dayEvents = eventsByDate.get(key) ?? []

      days.push({
        key,
        dayName: DAY_NAMES_DA[d.getDay()],
        dayNum: i,
        isPast: key < todayKey,
        isToday: key === todayKey,
        hasEvents: dayEvents.length > 0,
        events: dayEvents,
      })
    }
    return days
  }, [viewMonth, eventsByDate, todayKey])

  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedDate, viewMonth])

  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' })
  }, [])

  const prevMonth = () =>
    setViewMonth((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
    )
  const nextMonth = () =>
    setViewMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
    )

  const selectedEvents = eventsByDate.get(selectedDate) ?? []

  return (
    <div>
      <style>{`
        @media (min-width: 768px) {
          .cyc-day-btn { min-width: 56px !important; padding: 10px 8px 8px !important; }
          .cyc-day-num { font-size: 18px !important; }
        }
      `}</style>

      {/* Calendar strip */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EDE8E0', borderRadius: '2px 2px 0 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 600, color: sportColor }}>
            {MONTH_NAMES_DA[viewMonth.month]} {viewMonth.year}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={prevMonth}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #EDE8E0', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: sportColor }}
            >
              ‹
            </button>
            <button
              onClick={nextMonth}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #EDE8E0', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: sportColor }}
            >
              ›
            </button>
          </div>
        </div>

        {/* Day strip */}
        <div
          className="scrollbar-hide"
          style={{ display: 'flex', overflowX: 'auto', padding: '4px 12px 12px', gap: 0 }}
        >
          {daysInMonth.map((day) => {
            const isSelected = day.key === selectedDate
            const dayColor = isSelected
              ? '#fff'
              : day.isPast
                ? '#C0B8B0'
                : day.hasEvents
                  ? sportColor
                  : '#9E9486'

            // Show short race name for first event on this day
            const firstEvent = day.events[0]
            const badge = firstEvent
              ? SHORT_NAMES[firstEvent.race_slug] ?? firstEvent.race_name.split(' ')[0]
              : null

            return (
              <button
                key={day.key}
                ref={isSelected ? selectedDayRef : undefined}
                onClick={() => setSelectedDate(day.key)}
                className="cyc-day-btn"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '6px 8px 6px',
                  minWidth: 44,
                  borderRadius: 8,
                  border: 'none',
                  borderTop: '2px solid transparent',
                  cursor: 'pointer',
                  background: isSelected ? sportColor : 'transparent',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
                {/* Day name */}
                <span style={{ fontSize: 9, textTransform: 'uppercase', color: dayColor, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em' }}>
                  {day.dayName}
                </span>

                {/* Profile icon on event days */}
                {day.hasEvents && firstEvent && (
                  <ProfileBadge profile={firstEvent.profile} />
                )}

                {/* Date number */}
                <span
                  className="cyc-day-num"
                  style={{ fontSize: 16, fontWeight: 700, color: dayColor, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1.2 }}
                >
                  {day.dayNum}
                </span>

                {/* Today dot */}
                {day.isToday && !isSelected && (
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: sportColor }} />
                )}

                {/* Race name badge */}
                {day.hasEvents && badge && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: isSelected ? 'rgba(255,255,255,0.15)' : '#F2EDE4',
                      color: isSelected ? 'rgba(255,255,255,0.8)' : '#9E9486',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      whiteSpace: 'nowrap',
                      maxWidth: 48,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Event cards for selected day */}
      <div style={{ background: '#fff', borderTop: '1px solid #EDE8E0' }}>
        {selectedEvents.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: '#9E9486',
            fontFamily: "'Barlow', sans-serif",
            fontSize: 13,
          }}>
            Ingen løb denne dag
          </div>
        ) : (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedEvents.map((ev, i) => {
              const shortName = SHORT_NAMES[ev.race_slug] ?? ev.race_name
              const profileStyle = PROFILE_STYLES[ev.profile] ?? PROFILE_STYLES.mixed
              const isStage = ev.race_type === 'stage_race' && ev.stage_number != null

              return (
                <div
                  key={`${ev.race_slug}-${ev.stage_number ?? 'main'}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#FDFAF5',
                    border: '1px solid #E8E0D3',
                    borderRadius: 2,
                  }}
                >
                  {/* Profile icon */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 2,
                      background: `${profileStyle.color}18`,
                      color: profileStyle.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {profileStyle.icon}
                  </div>

                  {/* Race info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {shortName}
                    </div>
                    {isStage && (
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 11,
                        color: '#9E9486',
                        lineHeight: 1.2,
                        marginTop: 1,
                      }}>
                        Etape {ev.stage_number}
                        {ev.stage_name && ev.stage_name !== `Stage ${ev.stage_number}` && (
                          <span style={{ color: '#C0B8B0' }}> · {ev.stage_name}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 2,
                      flexShrink: 0,
                      background: ev.status === 'active' ? `${sportColor}18` : ev.status === 'finished' ? '#E8E0D3' : '#F2EDE4',
                      color: ev.status === 'active' ? sportColor : ev.status === 'finished' ? '#9E9486' : '#C0B8B0',
                    }}
                  >
                    {ev.status === 'active' ? 'Aktiv' : ev.status === 'finished' ? 'Slut' : 'Kommende'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
