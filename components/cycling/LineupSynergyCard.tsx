'use client'

import { useMemo, useState } from 'react'
import { Check, AlertTriangle, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { analyzeLineupSynergy, type SynergyCheck, type SynergyStatus } from '@/lib/cyclingLineupSynergy'

type Rider = {
  id: string
  last_name: string
  team_name: string
  category: number
}

type Props = {
  slots: Record<string, string | null>
  riders: Rider[]
  profile: string | null
}

const STATUS_STYLE: Record<SynergyStatus, { color: string; bg: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }> = {
  good: { color: '#9FE1CB', bg: 'rgba(107,143,113,0.18)', icon: Check },
  warn: { color: '#FAC775', bg: 'rgba(218,165,32,0.14)', icon: AlertTriangle },
  info: { color: '#8FABC4', bg: 'rgba(143,171,196,0.14)', icon: Info },
}

const STATUS_RANK: Record<SynergyStatus, number> = { good: 0, warn: 1, info: 2 }

export default function LineupSynergyCard({ slots, riders, profile }: Props) {
  const [open, setOpen] = useState(false)
  const checks = useMemo(
    () => analyzeLineupSynergy(slots, riders, profile),
    [slots, riders, profile],
  )
  if (checks.length === 0) return null

  const sorted = [...checks].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
  const goodCount = checks.filter((c) => c.status === 'good').length
  const warnCount = checks.filter((c) => c.status === 'warn').length

  // Header-summary varierer baseret på lineup-tilstand
  let summary: string
  if (warnCount === 0 && goodCount >= 3) summary = `Stærke synergier (${goodCount}) — godt arbejde`
  else if (warnCount > 0) summary = `${goodCount} synergi(er) · ${warnCount} mulig forbedring`
  else summary = `${goodCount} synergi(er) registreret`

  return (
    <div
      style={{
        margin: '0 14px 12px',
        background: 'rgba(201,168,76,0.06)',
        border: '1px solid rgba(201,168,76,0.22)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '8px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Sparkles size={12} color="#C9A84C" strokeWidth={2.4} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#C9A84C',
        }}>
          Synergi-check
        </span>
        <span style={{
          flex: 1,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, color: 'rgba(255,255,255,0.6)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {summary}
        </span>
        {open
          ? <ChevronUp size={12} color="#C9A84C" />
          : <ChevronDown size={12} color="#C9A84C" />}
      </button>

      {open && (
        <div style={{
          padding: '6px 12px 10px',
          borderTop: '1px solid rgba(201,168,76,0.18)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {sorted.map((check) => {
            const s = STATUS_STYLE[check.status]
            const Icon = s.icon
            return (
              <div
                key={check.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '6px 8px',
                  background: s.bg,
                  borderRadius: 2,
                }}
              >
                <Icon size={12} color={s.color} strokeWidth={2.4} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 12, fontWeight: 700,
                    color: s.color, letterSpacing: '0.02em',
                  }}>
                    {check.title}
                  </div>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 11, lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.72)',
                    marginTop: 1,
                  }}>
                    {check.detail}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
