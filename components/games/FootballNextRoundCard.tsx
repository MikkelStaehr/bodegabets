'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertCircle, Target } from 'lucide-react'

type Round = {
  id: number
  name: string
  betting_closes_at: string | null
  totalMatches: number
  userBets: number
  leagueAbbr: string
}

type Props = {
  rounds: Round[]
}

function formatCountdown(deadline: Date, now: Date): { text: string; urgent: boolean } {
  const ms = deadline.getTime() - now.getTime()
  if (ms < 0) return { text: 'Låst', urgent: true }
  const totalMin = Math.floor(ms / 60000)
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  const days = Math.floor(hours / 24)
  if (days >= 2) return { text: `${days} dage`, urgent: false }
  if (hours >= 24) return { text: `${days} dag ${hours % 24} t`, urgent: false }
  if (hours >= 1) return { text: `${hours} t ${mins} min`, urgent: hours < 2 }
  return { text: `${mins} min`, urgent: true }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Copenhagen',
  }).format(d)
}

/**
 * Sidebar-card for fodbold-gameroom — viser status for næste åbne runde:
 * countdown til betting-deadline, runde-navn, og din betting-progress
 * (X/Y kampe gættet). Når man scroller ned i listen af kampe, har man
 * altid deadline-context i venstre kolonne.
 */
export default function FootballNextRoundCard({ rounds }: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(t)
  }, [])

  // Find næste åbne runde: betting_closes_at i fremtiden, sorteret tidligst først
  const candidates = rounds
    .filter((r) => r.betting_closes_at && new Date(r.betting_closes_at).getTime() > now.getTime())
    .sort((a, b) => (a.betting_closes_at ?? '').localeCompare(b.betting_closes_at ?? ''))

  const next = candidates[0]

  if (!next) {
    return (
      <div style={{
        padding: '16px 14px',
        background: 'rgba(15,33,55,0.06)',
        border: '1px solid rgba(43,79,122,0.18)',
        borderRadius: 4,
      }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(43,79,122,0.7)',
          marginBottom: 6,
        }}>
          Næste runde
        </div>
        <div style={{
          fontFamily: "'Barlow', sans-serif", fontSize: 12,
          color: 'rgba(15,33,55,0.5)', lineHeight: 1.4,
        }}>
          Ingen åbne runder pt.
        </div>
      </div>
    )
  }

  const deadline = new Date(next.betting_closes_at!)
  const countdown = formatCountdown(deadline, now)
  const pct = next.totalMatches > 0 ? Math.round((next.userBets / next.totalMatches) * 100) : 0
  const progressColor = pct === 100 ? '#6B8F71' : pct >= 50 ? '#B8963E' : pct > 0 ? '#1E3A5F' : '#C8392B'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        padding: '14px 16px',
        background: '#FDFAF5',
        border: '1px solid #E8E0D3',
        borderRadius: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          marginBottom: 10,
        }}>
          <Clock size={11} color="#6b6b6b" strokeWidth={2.4} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#6b6b6b',
          }}>
            Næste runde
          </span>
        </div>

        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 14, fontWeight: 700,
          color: '#1a1a1a', lineHeight: 1.2,
        }}>
          {next.name}
        </div>
        <div style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: 12, color: '#6b6b6b',
          marginTop: 2, lineHeight: 1.3,
        }}>
          {next.leagueAbbr} · Lukker {formatDate(next.betting_closes_at!)}
        </div>

        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: '1px solid #E8E0D3',
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: countdown.urgent ? '#C8392B' : '#6b6b6b',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginBottom: 4,
          }}>
            {countdown.urgent && <AlertCircle size={11} strokeWidth={2.6} />}
            Bet-deadline om
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 22, fontWeight: 700,
            color: countdown.urgent ? '#C8392B' : '#1a1a1a',
            lineHeight: 1,
          }}>
            {countdown.text}
          </div>
        </div>
      </div>

      {/* Din betting-progress */}
      <div style={{
        padding: '12px 14px',
        background: '#FDFAF5',
        border: '1px solid #E8E0D3',
        borderRadius: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 8,
        }}>
          <Target size={11} color="#6b6b6b" strokeWidth={2.4} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#6b6b6b',
          }}>
            Din progress
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18, fontWeight: 700, color: progressColor,
          }}>
            {next.userBets} / {next.totalMatches}
          </span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 12, fontWeight: 700, color: progressColor,
          }}>
            {pct}%
          </span>
        </div>
        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 2,
          background: 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: progressColor,
            transition: 'width 0.3s',
          }} />
        </div>
        {pct < 100 && (
          <div style={{
            marginTop: 8,
            fontFamily: "'Barlow', sans-serif", fontSize: 11,
            color: '#6b6b6b', lineHeight: 1.4,
          }}>
            {next.totalMatches - next.userBets} kamp{next.totalMatches - next.userBets === 1 ? '' : 'e'} mangler endnu
          </div>
        )}
      </div>
    </div>
  )
}
