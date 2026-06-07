'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Target } from 'lucide-react'
import { getStageBriefing, profileLabel, type StageStrength } from '@/lib/cyclingRoleStageBonus'
import { useNarrowViewport } from '@/hooks/useNarrowViewport'

type Props = {
  profile: string | null
  slotKeys: string[]
}

const STRENGTH_COLOR: Record<StageStrength, { dot: string; text: string }> = {
  high: { dot: '#6B8F71', text: '#9FE1CB' },
  mid:  { dot: 'rgba(143,171,196,0.55)', text: 'rgba(255,255,255,0.7)' },
  low:  { dot: 'rgba(255,255,255,0.18)', text: 'rgba(255,255,255,0.42)' },
}

const STRENGTH_LABEL: Record<StageStrength, string> = {
  high: 'Stærk',
  mid: 'Solid',
  low: 'Svag',
}

export default function StageStrategyCard({ profile, slotKeys }: Props) {
  const [open, setOpen] = useState(false)
  const narrow = useNarrowViewport(480)
  const briefing = getStageBriefing(slotKeys, profile)
  if (briefing.length === 0) return null

  const strongRoles = briefing.filter((b) => b.bonus.strength === 'high')
  const profilTxt = profileLabel(profile)
  const summary = strongRoles.length > 0
    ? `Stærke roller: ${strongRoles.map((b) => b.label).join(', ')}`
    : `Ingen ekstra profil-bonus i dag`

  return (
    <div
      style={{
        margin: '8px 14px 0',
        background: 'rgba(74,144,217,0.08)',
        border: '1px solid rgba(74,144,217,0.25)',
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
        <Target size={12} color="#8FBEDF" strokeWidth={2.4} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#8FBEDF',
        }}>
          Stage-strategi{profilTxt ? ` — ${profilTxt}` : ''}
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
          ? <ChevronUp size={12} color="#8FABC4" />
          : <ChevronDown size={12} color="#8FABC4" />}
      </button>

      {open && (
        <div style={{
          padding: '4px 12px 10px',
          borderTop: '1px solid rgba(74,144,217,0.18)',
        }}>
          {briefing.map((entry) => {
            const c = STRENGTH_COLOR[entry.bonus.strength]
            return (
              <div
                key={entry.role}
                style={{
                  display: 'grid',
                  // Narrow: dot + tekstcontent (rolle+forklaring stacker) + strength.
                  // Wide: dot | rolle-label (fixed 90) | forklaring (1fr) | strength.
                  gridTemplateColumns: narrow ? '8px minmax(0, 1fr) auto' : '8px 90px minmax(0, 1fr) auto',
                  alignItems: narrow ? 'start' : 'center',
                  gap: 8,
                  padding: '5px 0',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: c.dot,
                  justifySelf: 'center',
                  marginTop: narrow ? 5 : 0,
                }} />
                {narrow ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 12, fontWeight: 700, color: c.text,
                    }}>
                      {entry.label}
                    </span>
                    <span style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 11, color: 'rgba(255,255,255,0.62)',
                      lineHeight: 1.35,
                    }}>
                      {entry.bonus.cardLine}
                    </span>
                  </div>
                ) : (
                  <>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 12, fontWeight: 700, color: c.text,
                    }}>
                      {entry.label}
                    </span>
                    <span style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 11, color: 'rgba(255,255,255,0.62)',
                      lineHeight: 1.35,
                    }}>
                      {entry.bonus.cardLine}
                    </span>
                  </>
                )}
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.06em', color: c.text,
                  padding: '1px 6px', borderRadius: 2,
                  background: entry.bonus.strength === 'high' ? 'rgba(107,143,113,0.18)' : 'transparent',
                  alignSelf: narrow ? 'start' : 'center',
                  marginTop: narrow ? 1 : 0,
                  whiteSpace: 'nowrap',
                }}>
                  {STRENGTH_LABEL[entry.bonus.strength]}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
