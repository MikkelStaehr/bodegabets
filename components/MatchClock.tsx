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

    const tick = () => {
      const now = Date.now()
      const start = new Date(kickoff).getTime()
      const elapsedSec = Math.floor((now - start) / 1000)
      const elapsed = Math.floor(elapsedSec / 60)
      const secs = elapsedSec % 60

      if (status === 'halftime') {
        setDisplay('HT')
        return
      }

      const pad = (n: number) => String(n).padStart(2, '0')

      // 2. halvleg starter ~60 min inde (45 min spil + ~15 min pause)
      if (elapsed > 60) {
        const secondHalf = elapsed - 60 + 45
        setDisplay(secondHalf > 90 ? `90:${pad(secs)}` : `${secondHalf}:${pad(secs)}`)
      } else if (elapsed > 45) {
        setDisplay(`45:${pad(secs)}`)
      } else {
        setDisplay(`${Math.max(1, elapsed)}:${pad(secs)}`)
      }
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
