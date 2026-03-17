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
      const start = new Date(kickoff).getTime()
      const elapsedMs = now - start
      const totalSeconds = Math.floor(elapsedMs / 1000)

      // 2. halvleg starter ~60 min inde (45 min + ~15 min pause)
      let displayMinutes: number
      let displaySeconds: number

      if (totalSeconds > 60 * 60) {
        // 2. halvleg
        const secondHalfSeconds = totalSeconds - (60 * 60) + (45 * 60)
        displayMinutes = Math.min(90, Math.floor(secondHalfSeconds / 60))
        displaySeconds = secondHalfSeconds % 60
      } else {
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
