'use client'

type Props = {
  status: 'live' | 'halftime' | 'finished' | 'scheduled'
}

export default function MatchClock({ status }: Props) {
  if (status === 'finished') {
    return (
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        color: '#9ca3af',
      }}>
        FT
      </span>
    )
  }

  if (status === 'halftime') {
    return (
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        color: '#f59e0b',
      }}>
        HT
      </span>
    )
  }

  if (status === 'live') {
    return (
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        color: '#ef4444',
      }}>
        ● LIVE
      </span>
    )
  }

  return null
}
