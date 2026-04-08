'use client'

import { useState, useMemo } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

type Score = {
  rider_id: string
  role: string
  is_bench: boolean
  base_points: number
  role_bonus: number
  role_multiplier: number
  jersey_points: number
  team_bonus: number
  bench_penalty: number
  dnf_penalty: number
  total_points: number
}

type Result = {
  rider_id: string
  position: number | null
  dnf: boolean
  abandon_type: string | null
  jersey: string | null
}

type Rider = {
  id: string
  first_name: string
  last_name: string
  team_name: string
  team_logo_url: string | null
  photo_url: string | null
  category: number
}

type Props = {
  race: {
    id: string
    name: string
    start_date: string
    status: string
    profile: string | null
  }
  slots: Record<string, string | null>
  scores: Score[]
  results: Result[]
  riders: Rider[]
  onEditRole?: (roleKey: string) => void
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  leader: 'Leader',
  lieutenant: 'Lieutenant',
  grimpeur: 'Grimpeur',
  sprinter: 'Sprinter',
  domestique: 'Domestique',
  equipier: 'Équipier',
  joker: 'Joker',
  bench: 'Bænk',
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  leader:     { bg: '#FAC775', color: '#633806' },
  lieutenant: { bg: '#B5D4F4', color: '#0C447C' },
  grimpeur:   { bg: '#9FE1CB', color: '#085041' },
  sprinter:   { bg: '#F5C4B3', color: '#712B13' },
  domestique: { bg: '#C0DD97', color: '#27500A' },
  equipier:   { bg: '#D3D1C7', color: '#444441' },
  joker:      { bg: '#CECBF6', color: '#3C3489' },
}

const ALL_ROLES: { key: string; label: string }[] = [
  { key: 'leader', label: 'Leader' },
  { key: 'lieutenant', label: 'Lieutenant' },
  { key: 'grimpeur', label: 'Grimpeur' },
  { key: 'sprinter', label: 'Sprinter' },
  { key: 'domestique', label: 'Domestique' },
  { key: 'equipier_0', label: 'Équipier' },
  { key: 'equipier_1', label: 'Équipier' },
  { key: 'joker', label: 'Joker' },
]

const ROLE_TOOLTIPS: Record<string, string> = {
  leader: 'Scorer point baseret på placering × kategori-multiplikator',
  lieutenant: 'Top 10 → ×1.8. Top 10 + Leader DNF → ×2.8. Kun Kat 2-3',
  grimpeur: 'Bjergbonus: Mountain ×1.5, Hilly ×1.2. Kun Kat 3-5',
  sprinter: 'Spurtbonus: Flat ×1.5, Hilly ×1.2. Kun Kat 1-3',
  domestique: '+8p hvis top 40 OG Leader top 10. Kun Kat 4',
  equipier: '+7p hvis samme hold som vinder',
  joker: '+7p hold-bonus. Immun mod alle minuspoint',
}

const POSITION_COLORS: Record<number, string> = {
  1: '#B8963E',
  2: '#A0A0A0',
  3: '#A0764A',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function RiderPhoto({ rider }: { rider: Rider }) {
  const src = rider.photo_url ?? rider.team_logo_url
  if (src) {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: '#fff', overflow: 'hidden', flexShrink: 0,
      }}>
        <img
          src={src}
          alt={rider.last_name}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
          }}
        />
      </div>
    )
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: '#2B4F7A', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: '#8FABC4', flexShrink: 0,
    }}>
      {rider.last_name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function PointsTooltip({ score, isJokerDnf }: { score: Score; isJokerDnf: boolean }) {
  if (isJokerDnf) return null

  const lines: { label: string; value: string }[] = [
    { label: 'Basispoint', value: `${score.base_points}` },
  ]
  if (score.role_bonus > 0) lines.push({ label: 'Rolle-bonus', value: `+${score.role_bonus}` })
  if (score.role_multiplier !== 1) lines.push({ label: 'Rolle-multiplikator', value: `×${score.role_multiplier}` })
  if (score.jersey_points > 0) lines.push({ label: 'Jersey-point', value: `+${score.jersey_points}` })
  if (score.team_bonus > 0) lines.push({ label: 'Hold-bonus', value: `+${score.team_bonus}` })
  if (score.dnf_penalty < 0) lines.push({ label: 'DNF-straf', value: `${score.dnf_penalty}` })
  if (score.bench_penalty < 0) lines.push({ label: 'Bænk-straf', value: `${score.bench_penalty}` })
  lines.push({ label: 'Total', value: `${score.total_points}` })

  return (
    <div style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
      background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 4,
      padding: '8px 12px', minWidth: 160, whiteSpace: 'nowrap',
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', gap: 16,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          fontWeight: line.label === 'Total' ? 700 : 400,
          color: line.label === 'Total' ? '#F2EDE4' : 'rgba(255,255,255,0.6)',
          borderTop: line.label === 'Total' ? '1px solid rgba(255,255,255,0.1)' : 'none',
          paddingTop: line.label === 'Total' ? 4 : 0,
          marginTop: line.label === 'Total' ? 4 : 0,
        }}>
          <span>{line.label}</span>
          <span>{line.value}</span>
        </div>
      ))}
    </div>
  )
}

function BenchTooltip({ benchScores, riders }: { benchScores: Score[]; riders: Map<string, Rider> }) {
  const penalties = benchScores.filter((s) => s.bench_penalty < 0)
  if (penalties.length === 0) return null

  return (
    <div style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
      background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 4,
      padding: '8px 12px', minWidth: 180, whiteSpace: 'nowrap',
    }}>
      {penalties.map((s) => {
        const r = riders.get(s.rider_id)
        return (
          <div key={s.rider_id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 16,
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
          }}>
            <span>{r ? `${r.last_name}` : '?'}</span>
            <span style={{ color: '#ff6b6b' }}>{s.bench_penalty}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LineupResults({ race, slots, scores, results, riders, onEditRole }: Props) {
  const [hoveredRider, setHoveredRider] = useState<string | null>(null)
  const [hoveredRole, setHoveredRole] = useState<string | null>(null)
  const [hoveredBench, setHoveredBench] = useState(false)

  const hasScores = scores.length > 0

  const riderMap = useMemo(() => {
    const map = new Map<string, Rider>()
    for (const r of riders) map.set(r.id, r)
    return map
  }, [riders])

  const scoreMap = useMemo(() => {
    const map = new Map<string, Score>()
    for (const s of scores) map.set(s.rider_id, s)
    return map
  }, [scores])

  const resultMap = useMemo(() => {
    const map = new Map<string, Result>()
    for (const r of results) map.set(r.rider_id, r)
    return map
  }, [results])

  const benchScores = hasScores ? scores.filter((s) => s.is_bench) : []
  const totalPoints = hasScores ? scores.reduce((sum, s) => sum + s.total_points, 0) : 0
  const benchPenaltyTotal = benchScores.reduce((sum, s) => sum + s.bench_penalty, 0)

  const canEdit = !!onEditRole && race.status !== 'finished'

  return (
    <div>
      {/* ── Total header ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.4)',
        }}>
          Lineup
        </span>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16,
          fontWeight: 700, color: hasScores ? '#F2EDE4' : 'rgba(255,255,255,0.35)',
        }}>
          {hasScores ? `${totalPoints} pt` : 'N/A'}
        </span>
      </div>

      {/* ── Column headers ──────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 40px 1fr auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {['PL.', '', 'RYTTER', 'ROLLE', 'PT.'].map((label, i) => (
          <span key={i} style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.3)',
            textAlign: i === 0 ? 'center' : i >= 3 ? 'right' : 'left',
          }}>
            {label}
          </span>
        ))}
      </div>

      {/* ── Role rows (always all 8) ────────────────────────── */}
      {ALL_ROLES.map((roleSlot, idx) => {
        const riderId = slots[roleSlot.key] ?? null
        const rider = riderId ? riderMap.get(riderId) : null
        const baseRole = roleSlot.key.startsWith('equipier_') ? 'equipier' : roleSlot.key

        if (rider && riderId) {
          // Filled slot
          const score = scoreMap.get(riderId)
          const result = resultMap.get(riderId)
          const role = score?.role ?? baseRole

          const isDnf = result?.dnf ?? false
          const position = result?.position ?? null
          const isJokerDnf = role === 'joker' && isDnf

          let posLabel: string
          let posColor = 'rgba(255,255,255,0.3)'
          if (!hasScores && !result) {
            posLabel = '—'
            posColor = 'rgba(255,255,255,0.25)'
          } else if (isDnf) {
            posLabel = 'DNF'
            posColor = '#ff6b6b'
          } else if (position) {
            posLabel = `${position}.`
            posColor = POSITION_COLORS[position] ?? 'rgba(255,255,255,0.5)'
          } else {
            posLabel = '—'
          }

          return (
            <div
              key={roleSlot.key}
              onClick={() => { if (canEdit) onEditRole!(roleSlot.key) }}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 40px 1fr auto auto',
                alignItems: 'center',
                gap: 10,
                cursor: canEdit ? 'pointer' : 'default',
                padding: '8px 14px',
                borderBottom: idx < ALL_ROLES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (canEdit) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: isDnf ? 11 : 14,
                fontWeight: 700, color: posColor, textAlign: 'center',
              }}>
                {posLabel}
              </span>

              <RiderPhoto rider={rider} />

              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                fontWeight: 500, color: '#F2EDE4', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                minWidth: 0,
              }}>
                <span style={{ textTransform: 'uppercase' }}>{rider.last_name}</span>
                {' '}{rider.first_name}
                {result?.jersey && (
                  <span style={{ marginLeft: 4, color: '#FAC775', fontSize: 10, fontWeight: 700 }}>
                    {result.jersey}
                  </span>
                )}
              </span>

              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
                    color: 'rgba(255,255,255,0.5)', textAlign: 'right',
                    cursor: ROLE_TOOLTIPS[baseRole] ? 'help' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={() => { if (ROLE_TOOLTIPS[baseRole]) setHoveredRole(roleSlot.key) }}
                  onMouseLeave={() => setHoveredRole(null)}
                >
                  {roleSlot.label}
                </span>
                {hoveredRole === roleSlot.key && ROLE_TOOLTIPS[baseRole] && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
                    background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 8,
                    padding: '8px 12px', maxWidth: 260,
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
                    color: 'rgba(255,255,255,0.7)', lineHeight: 1.4,
                    whiteSpace: 'normal',
                  }}>
                    {ROLE_TOOLTIPS[baseRole]}
                  </div>
                )}
              </div>

              {score ? (
                <div
                  style={{ position: 'relative', cursor: 'default' }}
                  onMouseEnter={() => setHoveredRider(riderId)}
                  onMouseLeave={() => setHoveredRider(null)}
                >
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
                    fontWeight: 700,
                    color: isJokerDnf ? 'rgba(255,255,255,0.4)' : score.total_points > 0 ? '#6B8F71' : score.total_points < 0 ? '#ff6b6b' : 'rgba(255,255,255,0.4)',
                  }}>
                    {isJokerDnf ? '0 pt (immun)' : `${score.total_points} pt`}
                  </span>
                  {hoveredRider === riderId && (
                    <PointsTooltip score={score} isJokerDnf={isJokerDnf} />
                  )}
                </div>
              ) : (
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
                  fontWeight: 600, color: 'rgba(255,255,255,0.25)',
                }}>
                  —
                </span>
              )}
            </div>
          )
        }

        // Empty slot
        return (
          <div
            key={roleSlot.key}
            onClick={() => { if (canEdit) onEditRole!(roleSlot.key) }}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 40px 1fr auto auto',
              alignItems: 'center',
              gap: 10,
              cursor: canEdit ? 'pointer' : 'default',
              padding: '8px 14px',
              borderBottom: idx < ALL_ROLES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (canEdit) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
              fontWeight: 700, color: 'rgba(255,255,255,0.15)', textAlign: 'center',
            }}>
              —
            </span>

            {/* Empty avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px dashed rgba(255,255,255,0.15)',
              flexShrink: 0,
            }} />

            <span style={{
              fontFamily: "'Barlow', sans-serif", fontSize: 12,
              color: 'rgba(255,255,255,0.25)', fontStyle: 'italic',
              minWidth: 0,
            }}>
              Vælg rytter
            </span>

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
              color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap',
            }}>
              {roleSlot.label}
            </span>

            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
              fontWeight: 600, color: 'rgba(255,255,255,0.15)',
            }}>
              —
            </span>
          </div>
        )
      })}

      {/* ── Bench section ────────────────────────────────────── */}
      {benchScores.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
            fontWeight: 600, color: 'rgba(255,255,255,0.35)',
          }}>
            Bænk — {benchScores.length} ryttere
          </span>
          <div
            style={{ position: 'relative', cursor: 'default' }}
            onMouseEnter={() => setHoveredBench(true)}
            onMouseLeave={() => setHoveredBench(false)}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
              fontWeight: 700,
              color: benchPenaltyTotal < 0 ? '#ff6b6b' : 'rgba(255,255,255,0.35)',
            }}>
              {benchPenaltyTotal < 0 ? `${benchPenaltyTotal} pt` : '0 pt'}
            </span>
            {hoveredBench && (
              <BenchTooltip benchScores={benchScores} riders={riderMap} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
