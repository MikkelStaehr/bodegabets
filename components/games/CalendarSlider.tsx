'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'

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
}

interface CalendarSliderProps {
  matches: CalendarMatch[]
  rounds: CalendarRound[]
  gameId: number
  betsCount: number
  activeRoundId: number | null
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
      tag: string | null
      tagType: 'league' | 'cup' | null
      tagLogoUrl: string | null
    }> = []

    for (let i = 1; i <= count; i++) {
      const d = new Date(year, month, i)
      const key = toDateKey(d)
      const dayMatches = matchesByDate.get(key) ?? []
      const hasLive = dayMatches.some((m) => m.status === 'live' || m.status === 'halftime')

      let tag: string | null = null
      let tagType: 'league' | 'cup' | null = null
      let tagLogoUrl: string | null = null
      if (dayMatches.length > 0) {
        const match = dayMatches[0]
        const lookupKey = `${match.season_id}-${match.round_name}`
        const round = roundByName.get(lookupKey)
        if (round) {
          tag = `${round.leagueAbbr} · ${getRoundNum(round.name)}`
          tagType = round.leagueType
          tagLogoUrl = round.logo_url ?? null
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
        tag,
        tagType,
        tagLogoUrl,
      })
    }
    return days
  }, [viewMonth, matchesByDate, roundByName, todayKey])

  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedDate, viewMonth])

  const selectedMatches = matchesByDate.get(selectedDate) ?? []
  const selectedFirstMatch = selectedMatches[0] ?? null
  const selectedRound = selectedFirstMatch
    ? roundByName.get(`${selectedFirstMatch.season_id}-${selectedFirstMatch.round_name}`) ?? null
    : null
  const isActiveRoundSelected = selectedRound?.id === activeRoundId

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
          .cal-day-btn { min-width: 56px !important; padding: 12px 8px 6px !important; }
          .cal-day-num { font-size: 18px !important; }
          .cal-day-tag { font-size: 9px !important; padding: 2px 6px !important; }
          .cal-day-tag-empty { height: 15px !important; }
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
          {daysInMonth.map((day) => {
            const isSelected = day.key === selectedDate
            const dayColor = isSelected
              ? '#fff'
              : day.hasLive
                ? '#e53935'
                : day.isPast
                  ? '#C0B8B0'
                  : '#2C4A3E'

            return (
              <button
                key={day.key}
                ref={isSelected ? selectedDayRef : undefined}
                onClick={() => setSelectedDate(day.key)}
                className="cal-day-btn"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '6px 8px 4px',
                  minWidth: 44,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: isSelected ? '#2C4A3E' : 'transparent',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
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
                {day.tag ? (
                  day.tagLogoUrl ? (
                    <img
                      src={day.tagLogoUrl}
                      alt={day.tag}
                      className="cal-day-tag"
                      style={{ width: 16, height: 16, objectFit: 'contain' }}
                    />
                  ) : (
                    <span
                      className="cal-day-tag"
                      style={{
                        fontSize: 7,
                        fontWeight: 600,
                        padding: '1px 4px',
                        borderRadius: 3,
                        background: isSelected
                          ? 'rgba(255,255,255,0.2)'
                          : day.tagType === 'cup'
                            ? 'rgba(184,150,62,0.15)'
                            : 'rgba(44,74,62,0.1)',
                        color: isSelected
                          ? '#fff'
                          : day.tagType === 'cup'
                            ? '#8B6914'
                            : '#2C4A3E',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {day.tag}
                    </span>
                  )
                ) : (
                  <span className="cal-day-tag-empty" style={{ height: 12 }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 16px', flexWrap: 'wrap' }}>
        {[
          { color: '#2C4A3E', label: 'Kommende' },
          { color: '#C0B8B0', label: 'Tidligere' },
          { color: '#e53935', label: 'Live' },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: '#9E9486',
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Selected day content */}
      {selectedMatches.length > 0 ? (
        <div style={{ padding: '12px 0 0' }}>
          {/* Round info + button */}
          {selectedRound && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 4px',
                marginBottom: 12,
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#2C4A3E',
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedRound.name}
                </span>
                {selectedRound.computedStatus === 'open' && selectedRound.betting_closes_at && (
                  <span style={{ fontSize: 11, color: '#9E9486', marginLeft: 8 }}>
                    Deadline:{' '}
                    {new Date(selectedRound.betting_closes_at).toLocaleString('da-DK', {
                      timeZone: 'Europe/Copenhagen',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              {(selectedRound.computedStatus === 'open' || selectedRound.computedStatus === 'active') && (
                <Link
                  href={`/games/${gameId}/rounds/${selectedRound.id}`}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '6px 14px',
                    borderRadius: 4,
                    background: '#2C4A3E',
                    color: '#F2EDE4',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isActiveRoundSelected && betsCount > 0 ? 'Se / ændr bets ›' : 'Afgiv bets ›'}
                </Link>
              )}
              {selectedRound.computedStatus === 'finished' && (
                <Link
                  href={`/games/${gameId}/rounds/${selectedRound.id}`}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 11,
                    color: '#9E9486',
                    textDecoration: 'none',
                  }}
                >
                  Se resultater →
                </Link>
              )}
            </div>
          )}

          {/* Match list */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {selectedMatches
              .slice()
              .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
              .map((match) => {
                const kickoff = new Date(match.kickoff_at)
                const timeStr = kickoff.toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' })
                const isLive = match.status === 'live' || match.status === 'halftime'
                const isFinished = match.status === 'finished'

                return (
                  <div
                    key={match.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 48px 1fr',
                      alignItems: 'center',
                      padding: '10px 4px',
                      borderBottom: '1px solid #EDE8E0',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        textAlign: 'right',
                        color: '#1a1a1a',
                        fontFamily: "'Barlow', sans-serif",
                      }}
                    >
                      {match.home_team}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        textAlign: 'center',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: isLive ? '#e53935' : '#2C4A3E',
                      }}
                    >
                      {isFinished || isLive ? `${match.home_score ?? 0}–${match.away_score ?? 0}` : timeStr}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#1a1a1a',
                        fontFamily: "'Barlow', sans-serif",
                      }}
                    >
                      {match.away_team}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      ) : (
        <div style={{ padding: '24px 4px', textAlign: 'center', color: '#9E9486', fontSize: 13 }}>
          Ingen kampe denne dag
        </div>
      )}
    </div>
  )
}
