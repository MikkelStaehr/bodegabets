'use client'

import Link from 'next/link'

export type ActiveRoundRow = {
  id: number
  name: string
  betting_closes_at: string | null
  totalMatches: number
  userBets: number
  leagueAbbr: string
  leagueType: 'league' | 'cup'
  logo_url?: string | null
}

interface ActiveRoundsProps {
  rounds: ActiveRoundRow[]
  gameId: number
}

export default function ActiveRounds({ rounds, gameId }: ActiveRoundsProps) {
  if (rounds.length === 0) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center',
          color: '#9E9486',
          fontSize: 13,
          fontFamily: "'Barlow', sans-serif",
        }}
      >
        Ingen åbne runder lige nu
      </div>
    )
  }

  const now = new Date()

  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 16px 12px',
          borderBottom: '1px solid #EDE8E0',
        }}
      >
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: '#2C4A3E',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Aktive betting runder
        </span>
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            background: '#2C4A3E',
            borderRadius: 10,
            padding: '1px 8px',
            lineHeight: '18px',
          }}
        >
          {rounds.length}
        </span>
      </div>

      {/* Rows */}
      {rounds.map((round, idx) => {
        const hasBets = round.userBets > 0
        const deadline = round.betting_closes_at ? new Date(round.betting_closes_at) : null
        const bettingOpen = deadline !== null && deadline > now
        const hoursLeft = deadline ? (deadline.getTime() - now.getTime()) / (1000 * 60 * 60) : null
        const isUrgent = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 24

        const tagColors =
          round.leagueType === 'cup'
            ? { bg: 'rgba(184,150,62,0.15)', color: '#8B6914' }
            : { bg: 'rgba(44,74,62,0.1)', color: '#2C4A3E' }

        return (
          <div
            key={round.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderBottom: idx < rounds.length - 1 ? '1px solid #EDE8E0' : 'none',
            }}
          >
            {/* Liga-tag */}
            {round.logo_url ? (
              <img
                src={round.logo_url}
                alt={round.leagueAbbr}
                style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: tagColors.bg,
                  color: tagColors.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {round.leagueAbbr}
              </span>
            )}

            {/* Round name + subtitle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1a1a1a',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {round.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#9E9486',
                  marginTop: 1,
                }}
              >
                {round.userBets}/{round.totalMatches} kampe afgivet
              </div>
            </div>

            {/* Status chip */}
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
                background: hasBets ? 'rgba(44,74,62,0.1)' : 'rgba(158,148,134,0.15)',
                color: hasBets ? '#2C4A3E' : '#9E9486',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {hasBets ? `✓ ${round.userBets} afgivet` : '— Mangler'}
            </span>

            {/* Deadline */}
            {deadline && (
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  color: isUrgent ? '#C62828' : '#9E9486',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minWidth: 48,
                  textAlign: 'right',
                }}
              >
                {deadline.toLocaleString('da-DK', {
                  timeZone: 'Europe/Copenhagen',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}

            {/* Button */}
            <Link
              href={`/games/${gameId}/rounds/${round.id}`}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '5px 12px',
                borderRadius: 4,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                ...(bettingOpen
                  ? {
                      background: '#2C4A3E',
                      color: '#F2EDE4',
                      border: '1px solid #2C4A3E',
                    }
                  : {
                      background: 'rgba(158,148,134,0.12)',
                      color: '#6b6b6b',
                      border: '1px solid #EDE8E0',
                    }),
              }}
            >
              {bettingOpen
                ? 'Afgiv bets →'
                : hasBets
                  ? 'Se resultater →'
                  : 'Se live →'}
            </Link>
          </div>
        )
      })}
    </div>
  )
}
