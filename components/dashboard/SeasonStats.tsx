'use client'

import { useEffect, useState } from 'react'

interface Stats {
  totalBets: number
  correctBets: number
  precision: number
}

export default function SeasonStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/users/me/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  if (!stats || stats.totalBets === 0) return null

  const items = [
    { value: stats.totalBets.toString(), label: 'Bets afgivet' },
    { value: stats.correctBets.toString(), label: 'Korrekte' },
    { value: `${stats.precision}%`, label: 'Præcision', gold: true },
  ]

  return (
    <div
      className="flex items-center gap-0 mb-7"
      style={{
        borderTop: '1px solid rgba(44,74,62,0.12)',
        borderBottom: '1px solid rgba(44,74,62,0.12)',
        paddingTop: '18px',
        paddingBottom: '18px',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            paddingRight: '28px',
            marginRight: '28px',
            borderRight: i < items.length - 1 ? '1px solid rgba(44,74,62,0.1)' : 'none',
          }}
        >
          <div
            className="font-serif text-3xl font-normal leading-none mb-1"
            style={{
              color: item.gold ? '#B8963E' : '#2C4A3E',
              letterSpacing: '-0.02em',
            }}
          >
            {item.value}
          </div>
          <div
            className="font-condensed font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#8C8C78' }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}
