'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

export type CalendarMatch = {
  id: number
  kickoff_at: string
  status: string
  round_name: string
  season_id: number
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  isRivalry?: boolean
}

export type CalendarRound = {
  id: number
  name: string
  season_id: number
  computedStatus: 'upcoming' | 'open' | 'active' | 'finished'
  betting_closes_at: string | null
  leagueAbbr: string
  leagueType: 'league' | 'cup'
  logo_url?: string | null
  block_id?: number | null
  block_number?: number | null
}

interface CalendarSliderProps {
  matches: CalendarMatch[]
  rounds: CalendarRound[]
  gameId: number
  betsCount: number
  activeRoundId: number | null
  activeBlockId?: number | null
}

const DAY_NAMES_DA = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const MONTH_NAMES_DA = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
]

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getRoundNum(name: string): string {
  const m = name.match(/\d+/)
  return m ? `R${m[0]}` : name
}

export default function CalendarSlider({
  matches,
  rounds,
  gameId,
  betsCount,
  activeRoundId,
  activeBlockId,
}: CalendarSliderProps) {
  const matchesByDate = useMemo(() => {
    const map = new Map<string, CalendarMatch[]>()
    for (const m of matches) {
      const key = toDateKey(new Date(m.kickoff_at))
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    return map
  }, [matches])

  const roundByName = useMemo(() => {
    const map = new Map<string, CalendarRound>()
    for (const r of rounds) map.set(`${r.season_id}-${r.name}`, r)
    return map
  }, [rounds])

  const today = new Date()
  const todayKey = toDateKey(today)

  const defaultDate = useMemo(() => {
    if (matchesByDate.has(todayKey)) return todayKey
    const sortedDates = [...matchesByDate.keys()].sort()
    const future = sortedDates.find((d) => d >= todayKey)
    if (future) return future
    return sortedDates[sortedDates.length - 1] ?? todayKey
  }, [matchesByDate, todayKey])

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
      hasLive: boolean
      hasMatches: boolean
      logoUrl: string | null
      roundNum: string | null
      blockId: number | null
      blockNum: number | null
      isBlockStart: boolean
      hasRivalry: boolean
    }> = []

    let prevMatchBlockId: number | null | undefined = undefined

    for (let i = 1; i <= count; i++) {
      const d = new Date(year, month, i)
      const key = toDateKey(d)
      const dayMatches = matchesByDate.get(key) ?? []
      const hasLive = dayMatches.some((m) => m.status === 'live' || m.status === 'halftime')
      const hasRivalry = dayMatches.some((m) => m.isRivalry === true)

      let logoUrl: string | null = null
      let roundNum: string | null = null
      let blockId: number | null = null
      let blockNum: number | null = null
      let isBlockStart = false

      if (dayMatches.length > 0) {
        const match = dayMatches[0]
        const lookupKey = `${match.season_id}-${match.round_name}`
        const round = roundByName.get(lookupKey)
        if (round) {
          logoUrl = round.logo_url ?? null
          roundNum = getRoundNum(round.name)
          blockId = round.block_id ?? null
          blockNum = round.block_number ?? null
          if (blockId !== null && blockId !== prevMatchBlockId) {
            isBlockStart = true
          }
          prevMatchBlockId = blockId
        }
      }

      days.push({
        key,
        dayName: DAY_NAMES_DA[d.getDay()],
        dayNum: i,
        isPast: key < todayKey,
        isToday: key === todayKey,
        hasLive,
        hasMatches: dayMatches.length > 0,
        logoUrl,
        roundNum,
        blockId,
        blockNum,
        isBlockStart,
        hasRivalry,
      })
    }
    return days
  }, [viewMonth, matchesByDate, roundByName, todayKey])

  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedDate, viewMonth])

  // Scroll til valgt dag ved mount (ingen animation)
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

  return (
    <div>
      <style>{`
        @media (min-width: 768px) {
          .cal-day-btn { min-width: 56px !important; padding: 10px 8px 8px !important; }
          .cal-day-num { font-size: 18px !important; }
        }
      `}</style>
      {/* Calendar container */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EDE8E0', borderRadius: '2px 2px 0 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: '#2C4A3E',
            }}
          >
            {MONTH_NAMES_DA[viewMonth.month]} {viewMonth.year}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={prevMonth}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1px solid #EDE8E0',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: '#2C4A3E',
              }}
            >
              ‹
            </button>
            <button
              onClick={nextMonth}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1px solid #EDE8E0',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: '#2C4A3E',
              }}
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
          {daysInMonth.flatMap((day) => {
            const isSelected = day.key === selectedDate
            const isActiveBlock = activeBlockId != null && day.blockId === activeBlockId && day.hasMatches
            const dayColor = isSelected
              ? '#fff'
              : day.hasLive
                ? '#e53935'
                : day.isPast
                  ? '#C0B8B0'
                  : '#2C4A3E'

            const elements = []

            // Block separator before first day of new block
            if (day.isBlockStart && day.blockNum !== null) {
              elements.push(
                <div
                  key={`block-sep-${day.key}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingBottom: 10,
                    paddingLeft: 2,
                    paddingRight: 4,
                    flexShrink: 0,
                    gap: 3,
                  }}
                >
                  <div style={{ width: 1, height: 32, background: '#EDE8E0' }} />
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 8,
                      fontWeight: 700,
                      color: '#C8B89A',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    B{day.blockNum}
                  </span>
                </div>
              )
            }

            elements.push(
              <button
                key={day.key}
                ref={isSelected ? selectedDayRef : undefined}
                onClick={() => setSelectedDate(day.key)}
                className="cal-day-btn"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '6px 8px 6px',
                  minWidth: 44,
                  borderRadius: 8,
                  border: 'none',
                  borderTop: isActiveBlock && !isSelected ? '2px solid #C8B89A' : '2px solid transparent',
                  cursor: 'pointer',
                  background: isSelected ? '#2C4A3E' : 'transparent',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
                {/* Day name */}
                <span
                  style={{
                    fontSize: 9,
                    textTransform: 'uppercase',
                    color: dayColor,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    letterSpacing: '0.05em',
                  }}
                >
                  {day.dayName}
                </span>

                {/* Tournament logo — only on match days */}
                {day.hasMatches && day.logoUrl && (
                  <img
                    src={day.logoUrl}
                    alt=""
                    style={{
                      width: 28,
                      height: 28,
                      objectFit: 'contain',
                      opacity: day.isPast && !isSelected ? 0.35 : 1,
                      filter: isSelected ? 'brightness(0) invert(1)' : 'none',
                    }}
                  />
                )}

                {/* Date number */}
                <span
                  className="cal-day-num"
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: dayColor,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    lineHeight: 1.2,
                  }}
                >
                  {day.dayNum}
                </span>

                {/* Rivalry indicator */}
                {day.hasMatches && day.hasRivalry && (
                  <span style={{ fontSize: 9, lineHeight: 1 }}>🔥</span>
                )}

                {/* Round number badge — only on match days */}
                {day.hasMatches && day.roundNum && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: isSelected ? 'rgba(255,255,255,0.15)' : '#F2EDE4',
                      color: isSelected ? 'rgba(255,255,255,0.8)' : '#9E9486',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {day.roundNum}
                  </span>
                )}
              </button>
            )

            return elements
          })}
        </div>
      </div>

    </div>
  )
}
