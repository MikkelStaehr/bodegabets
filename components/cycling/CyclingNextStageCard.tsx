'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertCircle, Mountain, Radio, Trophy } from 'lucide-react'
import { getStageDeadline, getStageStartTime, isStageDeadlinePassed } from '@/lib/cyclingDeadline'
import { PROFILE_LABELS, PROFILE_ICONS, shortBlockName } from '@/lib/cyclingUtils'

type Stage = {
  id: string
  race_id: string
  stage_number: number
  name: string
  profile: string | null
  start_date: string
  start_time_utc: string | null
  distance_km: number | null
  vertical_meters: number | null
  results_uploaded_at: string | null
  race_name: string
  cycling_block_id: string | null
}

type Block = {
  id: string
  name: string
  status?: string
}

type Props = {
  stages: Stage[]
  activeBlock: Block | null
  /** Spil-id til at hente brugerens rank fra leaderboard. */
  gameId: number
  /** Brugerens ID til at finde egen rank. */
  currentUserId: string
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

function formatLocalTime(stage: Stage): string {
  const start = getStageStartTime(stage.start_date, stage.start_time_utc)
  if (!start) return '—'
  // Vis tid i bruger-lokal timezone (typisk CEST for danske brugere)
  return new Intl.DateTimeFormat('da-DK', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Copenhagen',
  }).format(start)
}

function formatDate(stage: Stage): string {
  const d = new Date(stage.start_date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'Europe/Copenhagen' }).format(d)
}

export default function CyclingNextStageCard({ stages, activeBlock, gameId, currentUserId }: Props) {
  const [now, setNow] = useState(() => new Date())
  const [userRank, setUserRank] = useState<number | null>(null)
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(t)
  }, [])

  // Hent rank fra leaderboard. Polles ikke — opdateres ved page navigation.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/games/${gameId}/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const board = data.leaderboard ?? []
        setTotalPlayers(board.length)
        const idx = board.findIndex((e: { user_id: string }) => e.user_id === currentUserId)
        if (idx >= 0) setUserRank(idx + 1)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [gameId, currentUserId])

  // Find LIVE stage først: deadline passeret + ikke færdig + indenfor 12 timer
  const liveStage = stages
    .filter((s) => !s.results_uploaded_at)
    .filter((s) => activeBlock ? s.cycling_block_id === activeBlock.id : true)
    .find((s) => {
      const start = getStageStartTime(s.start_date, s.start_time_utc)
      if (!start) return false
      const hoursSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60)
      return hoursSinceStart >= 0 && hoursSinceStart < 12
    })

  // Find næste etape efter live stage: ikke færdig OG deadline ikke passeret
  const candidates = stages
    .filter((s) => !s.results_uploaded_at)
    .filter((s) => !isStageDeadlinePassed(s.start_date, now, s.start_time_utc))
    .filter((s) => activeBlock ? s.cycling_block_id === activeBlock.id : true)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

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
          Næste etape
        </div>
        <div style={{
          fontFamily: "'Barlow', sans-serif", fontSize: 12,
          color: 'rgba(15,33,55,0.5)', lineHeight: 1.4,
        }}>
          Ingen kommende etaper med åben deadline.
        </div>
      </div>
    )
  }

  const deadline = getStageDeadline(next.start_date, next.start_time_utc)
  const countdown = deadline ? formatCountdown(deadline, now) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {activeBlock && (
        <div style={{
          padding: '10px 14px',
          background: '#0F2137',
          borderRadius: 4,
          color: '#F2EDE4',
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'rgba(242,237,228,0.55)',
          }}>
            Aktiv blok
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18, fontWeight: 700,
            color: '#F2EDE4',
            marginTop: 2,
          }}>
            {shortBlockName(activeBlock.name)}
          </div>
          {userRank != null && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: '1px solid rgba(242,237,228,0.15)',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'rgba(242,237,228,0.55)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Trophy size={9} strokeWidth={2.5} />
                Din placering
              </span>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 14, fontWeight: 700, color: '#FAC775',
              }}>
                #{userRank}{totalPlayers ? ` / ${totalPlayers}` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* LIVE-indikator: vises hvis en stage er igang */}
      {liveStage && (
        <div style={{
          padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(216,58,58,0.15), rgba(216,58,58,0.05))',
          border: '1px solid rgba(216,58,58,0.4)',
          borderRadius: 4,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 6,
          }}>
            <Radio
              size={11} color="#D83A3A" strokeWidth={2.6}
              style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
            />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#D83A3A',
            }}>
              Live nu
            </span>
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13, fontWeight: 700, color: '#1a1a1a',
            lineHeight: 1.3,
          }}>
            {liveStage.stage_number === 0 ? 'Prolog' : `Etape ${liveStage.stage_number}`} ruller
          </div>
          <div style={{
            fontFamily: "'Barlow', sans-serif", fontSize: 11,
            color: '#6b6b6b', marginTop: 2, lineHeight: 1.3,
          }}>
            {liveStage.race_name}
          </div>
        </div>
      )}

      {/* Næste etape card */}
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
            Næste etape
          </span>
        </div>

        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 14, fontWeight: 700,
          color: '#1a1a1a', lineHeight: 1.2,
        }}>
          {next.stage_number === 0 ? 'Prolog' : `Etape ${next.stage_number}`}
        </div>
        <div style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: 12, color: '#6b6b6b',
          marginTop: 2, lineHeight: 1.3,
        }}>
          {next.race_name}
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          marginTop: 10,
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 700,
            padding: '2px 7px', borderRadius: 2,
            background: 'rgba(15,33,55,0.08)', color: '#1a1a1a',
          }}>
            {formatDate(next)} kl. {formatLocalTime(next)}
          </span>
          {next.distance_km != null && next.distance_km > 0 && (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 2,
              background: 'rgba(15,33,55,0.05)', color: '#6b6b6b',
            }}>
              {next.distance_km} km
            </span>
          )}
          {next.profile && PROFILE_LABELS[next.profile] && (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 2,
              background: 'rgba(15,33,55,0.05)', color: '#6b6b6b',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {PROFILE_ICONS[next.profile]} {PROFILE_LABELS[next.profile]}
            </span>
          )}
        </div>

        {countdown && (
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
              Lineup låser om
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
        )}
      </div>

      {/* Bonus-pill hvis bjerg-profil */}
      {next.profile === 'mountain' && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(107,143,113,0.12)',
          border: '1px solid rgba(107,143,113,0.3)',
          borderRadius: 4,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <Mountain size={14} color="#557A56" strokeWidth={2.2} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, fontWeight: 700, color: '#557A56',
              letterSpacing: '0.04em',
            }}>
              Grimpeur ×1.8
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 11, color: '#456947', lineHeight: 1.4,
              marginTop: 2,
            }}>
              Bjerg-etape — Grimpeur scorer 80% mere i dag.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
