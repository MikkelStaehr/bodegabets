'use client'

import { useState, useEffect } from 'react'

type Props = {
  kickoff: string
  status: 'live' | 'halftime' | 'finished' | 'scheduled'
  secondHalfStartedAt?: string | null
}

export default function MatchClock({ kickoff, status, secondHalfStartedAt }: Props) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (status === 'finished') { setDisplay('FT'); return }
    if (status === 'scheduled') { setDisplay(''); return }
    if (status === 'halftime') { setDisplay('HT'); return }

    const tick = () => {
      const now = Date.now()

      let displayMinutes: number
      let displaySeconds: number

      if (secondHalfStartedAt) {
        // 2. halvleg — tæl fra second_half_started_at
        const shNormalized = secondHalfStartedAt
          .replace(' ', 'T')
          .replace(/\+00$/, 'Z')
          .replace(/\+00:00$/, 'Z')
        const elapsed = now - new Date(shNormalized).getTime()
        displayMinutes = Math.min(90, 45 + Math.floor(elapsed / 60000))
        displaySeconds = Math.floor((elapsed % 60000) / 1000)
      } else {
        // 1. halvleg — tæl fra kickoff
        const normalizedKickoff = kickoff
          .replace(' ', 'T')
          .replace(/\+00$/, 'Z')
          .replace(/\+00:00$/, 'Z')
        const elapsed = now - new Date(normalizedKickoff).getTime()
        displayMinutes = Math.min(45, Math.floor(elapsed / 60000))
        displaySeconds = Math.floor((elapsed % 60000) / 1000)
      }

      const mm = String(displayMinutes).padStart(2, '0')
      const ss = String(displaySeconds).padStart(2, '0')
      setDisplay(`${mm}:${ss}`)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [kickoff, status, secondHalfStartedAt])

  if (!display) return null

  const color = status === 'live'
    ? '#ef4444'
    : status === 'halftime'
    ? '#f59e0b'
    : '#9ca3af'

  return (
    <span style={{
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 12,
      fontWeight: 700,
      color,
      minWidth: 32,
      textAlign: 'right'
    }}>
      {display}
    </span>
  )
}
