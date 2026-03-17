'use client'

import { useState, useEffect } from 'react'

type Props = {
  kickoff: string
  status: 'live' | 'halftime' | 'finished' | 'scheduled'
}

export default function MatchClock({ kickoff, status }: Props) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (status === 'finished') { setDisplay('FT'); return }
    if (status === 'scheduled') { setDisplay(''); return }
    if (status === 'halftime') { setDisplay('HT'); return }

    const tick = () => {
      const now = Date.now()
      const start = new Date(kickoff.includes('T') ? kickoff : kickoff.replace(' ', 'T')).getTime()
      const elapsedMs = now - start
      const totalSeconds = Math.floor(elapsedMs / 1000)

      let displayMinutes: number
      let displaySeconds: number

      if (totalSeconds > 52 * 60) {
        // 2. halvleg — tæl fra 45:00
        const secondHalfSeconds = totalSeconds - (52 * 60)
        displayMinutes = Math.min(90, 45 + Math.floor(secondHalfSeconds / 60))
        displaySeconds = secondHalfSeconds % 60
      } else {
        // 1. halvleg
        displayMinutes = Math.min(45, Math.floor(totalSeconds / 60))
        displaySeconds = totalSeconds % 60
      }

      const mm = String(displayMinutes).padStart(2, '0')
      const ss = String(displaySeconds).padStart(2, '0')
      setDisplay(`${mm}:${ss}`)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [kickoff, status])

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
