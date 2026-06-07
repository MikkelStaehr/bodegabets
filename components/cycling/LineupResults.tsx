'use client'

import { useState, useMemo } from 'react'
import { Check, AlertTriangle, X as XIcon } from 'lucide-react'
import { type JerseyKey } from '@/lib/cyclingJerseys'
import JerseyIcon from './JerseyIcon'
import { getRoleStageBonus } from '@/lib/cyclingRoleStageBonus'
import { analyzeLineupSynergy, worstStatus, type RiderSynergyCheck, type SynergyStatus } from '@/lib/cyclingLineupSynergy'

// ── Types ───────────────────────────────────────────────────────────────────

type Score = {
  rider_id: string
  role: string
  is_bench: boolean
  base_points: number
  role_bonus: number
  role_multiplier: number
  gc_multiplier: number
  /** Breakdown af role_multiplier (cat × profile × train). 1.0 hvis ikke aktivt. */
  cat_multiplier?: number | null
  profile_multiplier?: number | null
  train_multiplier?: number | null
  jersey_points: number
  team_bonus: number
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
  /** Sætter editor-tilstand på stage-niveau. Hvis ikke angivet falder vi tilbage
   *  til race.status (bagudkompatibel for one-day løb der ikke har en stage-prop). */
  stageFinished?: boolean
  slots: Record<string, string | null>
  scores: Score[]
  results: Result[]
  riders: Rider[]
  /** Current standings snapshot fra seneste stage (jersey + GC position).
   *  Bruges til at vise hvilke valgte ryttere der bærer trøjer GÅR IND TIL
   *  denne stage. Forskelligt fra Result.jersey som er per-stage. */
  standings?: Record<string, { jersey: string | null; gc_position: number | null }>
  onEditRole?: (roleKey: string) => void
  /** Dynamiske roller: hvilke rolle-slots der vises (afhænger af etape-profil).
   *  Falder tilbage til det fulde faste sæt hvis ikke angivet. */
  slotKeys?: string[]
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
  leader: 'Point = placering × kategori. +5 holdbonus hvis vinderens hold. Alle kategorier.',
  lieutenant: 'Top 10 → ×1.8 (×2.8 hvis Leader udgår). +5 holdbonus. Kun Kat 2–3.',
  grimpeur: 'Bjerg ×1.8, bakket/brosten ×1.2. Won-how-bonus: Solo +50 (+1/km), Sprint à deux +25, Small group +20. Kun Kat 3–5.',
  sprinter: 'Flad ×1.8, bakket/brosten ×1.2. Forstærkes af leadout-tog (équipier fra samme hold) hvis top-3. Kun Kat 1–3.',
  domestique: '+8 hvis top 40 OG Leader top 10. Ingen multiplikator. Kun Kat 4.',
  equipier: '+7 hvis samme hold som vinder. Fungerer som leadout for en sprinter på samme hold. Ingen multiplikator.',
  joker: '+7 hvis vinderens hold. Ingen multiplikator.',
}

const POSITION_COLORS: Record<number, string> = {
  1: '#B8963E',
  2: '#A0A0A0',
  3: '#A0764A',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const SYNERGY_COLORS: Record<SynergyStatus, { fill: string; bg: string; ring: string }> = {
  good: { fill: '#9FE1CB', bg: 'rgba(107,143,113,0.25)', ring: 'rgba(159,225,203,0.5)' },
  warn: { fill: '#FAC775', bg: 'rgba(218,165,32,0.22)', ring: 'rgba(250,199,117,0.5)' },
  bad:  { fill: '#E26D5C', bg: 'rgba(200,57,43,0.22)',  ring: 'rgba(226,109,92,0.5)' },
  info: { fill: '#8FABC4', bg: 'rgba(143,171,196,0.18)', ring: 'rgba(143,171,196,0.4)' },
}

/**
 * Lille klikbar status-badge ved rytter-navn der opsummerer rytterens
 * synergi-tilstand. Klik viser popover med detaljer. Hvis rytteren ikke
 * har nogen checks (= ingen synergi-info), vises intet.
 */
function SynergyBadge({
  checks, open, onToggle,
}: {
  riderId: string
  checks: RiderSynergyCheck[]
  open: boolean
  onToggle: () => void
}) {
  if (checks.length === 0) return null
  const worst = worstStatus(checks)
  if (!worst) return null
  const c = SYNERGY_COLORS[worst]
  const Icon = worst === 'good' ? Check : worst === 'bad' ? XIcon : worst === 'warn' ? AlertTriangle : Check

  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        title="Synergi-detalje"
        aria-label={`Synergi for rytter — ${checks.length} ${checks.length === 1 ? 'note' : 'noter'}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: '50%',
          background: c.bg, border: `1px solid ${c.ring}`,
          color: c.fill, cursor: 'pointer', padding: 0,
        }}
      >
        <Icon size={9} strokeWidth={3} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20,
            background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 4,
            padding: '8px 10px',
            width: 'max-content', minWidth: 200,
            maxWidth: 'min(280px, calc(100vw - 24px))',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          {checks.map((check, i) => {
            const cc = SYNERGY_COLORS[check.status]
            return (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', gap: 1,
                paddingBottom: i < checks.length - 1 ? 6 : 0,
                borderBottom: i < checks.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11, fontWeight: 700, color: cc.fill,
                  letterSpacing: '0.02em',
                }}>
                  {check.title}
                </span>
                <span style={{
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 11, lineHeight: 1.45,
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  {check.detail}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </span>
  )
}

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

function fmtMul(n: number): string {
  // Pæn formatering: 1.8, 2.808, 1.2 — drop trailing 0
  return `×${(Math.round(n * 1000) / 1000).toString()}`
}

function PointsTooltip({ score, isJokerDnf }: { score: Score; isJokerDnf: boolean }) {
  if (isJokerDnf) return null

  // Breakdown: hvis de granulere felter er udfyldt (efter migration + re-score)
  // viser vi cat × profile × train hver for sig. Falder tilbage til samlet
  // role_multiplier hvis felterne ikke er sat (gamle scores før migration).
  const catMul = score.cat_multiplier ?? null
  const profileMul = score.profile_multiplier ?? null
  const trainMul = score.train_multiplier ?? null
  const hasBreakdown =
    (catMul != null && catMul !== 1) ||
    (profileMul != null && profileMul !== 1) ||
    (trainMul != null && trainMul !== 1)

  type Line = { label: string; value: string; highlight?: boolean; isTotal?: boolean }
  const lines: Line[] = [
    { label: 'Basispoint', value: `${score.base_points}` },
  ]
  if (score.role_bonus > 0) lines.push({ label: 'Rolle-bonus', value: `+${score.role_bonus}` })

  if (hasBreakdown) {
    if (catMul != null && catMul !== 1) lines.push({ label: 'Kategori', value: fmtMul(catMul) })
    if (profileMul != null && profileMul !== 1) lines.push({ label: 'Profil/rolle', value: fmtMul(profileMul) })
    if (trainMul != null && trainMul !== 1) lines.push({ label: 'Spurt-tog', value: fmtMul(trainMul), highlight: true })
  } else if (score.role_multiplier !== 1) {
    lines.push({ label: 'Rolle-multiplikator', value: fmtMul(score.role_multiplier) })
  }

  if (score.gc_multiplier && score.gc_multiplier !== 1) lines.push({ label: 'GC-multiplikator', value: fmtMul(score.gc_multiplier) })
  if (score.jersey_points > 0) lines.push({ label: 'Jersey-point', value: `+${score.jersey_points}` })
  if (score.team_bonus > 0) lines.push({ label: 'Hold-bonus', value: `+${score.team_bonus}` })
  lines.push({ label: 'Total', value: `${Math.round(score.total_points * 10) / 10}`, isTotal: true })

  const roleAnchor = score.role.replace(/_\d+$/, '')

  return (
    <div style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
      background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 4,
      padding: '8px 12px', minWidth: 180, whiteSpace: 'nowrap',
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', gap: 16,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          fontWeight: line.isTotal ? 700 : line.highlight ? 600 : 400,
          color: line.isTotal
            ? '#F2EDE4'
            : line.highlight
              ? '#FAC775'  // gold-ish for spurt-tog
              : 'rgba(255,255,255,0.6)',
          borderTop: line.isTotal ? '1px solid rgba(255,255,255,0.1)' : 'none',
          paddingTop: line.isTotal ? 4 : 0,
          marginTop: line.isTotal ? 4 : 0,
        }}>
          <span>{line.label}</span>
          <span>{line.value}</span>
        </div>
      ))}
      <a
        href={`/games/cycling-guide#${roleAnchor}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block', marginTop: 6, paddingTop: 6,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, fontWeight: 600,
          color: '#C9A84C', textDecoration: 'none',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
      >
        Sådan beregnes point →
      </a>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LineupResults({ race, stageFinished, slots, scores, results, riders, standings, onEditRole, slotKeys }: Props) {
  const [hoveredRider, setHoveredRider] = useState<string | null>(null)
  const [hoveredRole, setHoveredRole] = useState<string | null>(null)
  // pinnedRole holder rolle-popover åben på klik (til mobile / persistent læsning).
  // Bruges parallelt med hoveredRole — den ene viser hvis den anden ikke gør.
  const [pinnedRole, setPinnedRole] = useState<string | null>(null)
  // Synergi-popover state — vises inline ved klik på status-ikon.
  const [openSynergy, setOpenSynergy] = useState<string | null>(null)

  // Per-rytter synergi-checks for det aktuelle lineup. Tomt map hvis stagen
  // er færdig (synergi-info er ikke relevant når point er beregnet).
  const stageDoneForSynergy = stageFinished ?? (race.status === 'finished')
  const synergyByRider = useMemo(() => {
    if (stageDoneForSynergy) return new Map<string, RiderSynergyCheck[]>()
    return analyzeLineupSynergy(slots, riders, race.profile)
  }, [slots, riders, race.profile, stageDoneForSynergy])

  // Dynamiske roller: brug de medsendte slot-keys (afhænger af profil), ellers
  // det fulde faste sæt. Label udledes fra base-rollen (equipier_N → Équipier).
  const roleSlots = (slotKeys && slotKeys.length > 0 ? slotKeys : ALL_ROLES.map((r) => r.key)).map((key) => ({
    key,
    label: ROLE_LABELS[key.startsWith('equipier_') ? 'equipier' : key] ?? key,
  }))

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

  const fmt = (n: number) => Math.round(n * 10) / 10
  const benchScores = hasScores ? scores.filter((s) => s.is_bench) : []
  const totalPoints = hasScores ? fmt(scores.reduce((sum, s) => sum + s.total_points, 0)) : 0

  // canEdit baseret på stage-status (med race som fallback) — NÆG at lade en
  // user redigere et færdigt stages lineup bare fordi race'et stadig er active.
  const stageDone = stageFinished ?? (race.status === 'finished')
  const canEdit = !!onEditRole && !stageDone

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
      {roleSlots.map((roleSlot, idx) => {
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
                borderBottom: idx < roleSlots.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
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
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <SynergyBadge
                  riderId={rider.id}
                  checks={synergyByRider.get(rider.id) ?? []}
                  open={openSynergy === rider.id}
                  onToggle={() => setOpenSynergy((curr) => curr === rider.id ? null : rider.id)}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ textTransform: 'uppercase' }}>{rider.last_name}</span>
                  {' '}{rider.first_name}
                </span>
                {result?.jersey && result.jersey.split(',').map((j) => j.trim()).filter(Boolean).map((j) => (
                  <span key={j} style={{ display: 'inline-flex', verticalAlign: 'middle', flexShrink: 0 }}>
                    <JerseyIcon jersey={j as JerseyKey} raceName={race.name} size={18} title={`Bærer ${j}-trøjen`} />
                  </span>
                ))}
                {/* Pre-stage current standings (kun hvis stage ikke er done og
                    rytteren ikke allerede har en result.jersey for denne stage) */}
                {!stageDone && !result?.jersey && standings && (() => {
                  const s = standings[rider.id]
                  if (!s) return null
                  return (
                    <>
                      {s.jersey && (
                        <span style={{ marginLeft: 4, display: 'inline-flex', verticalAlign: 'middle' }}>
                          <JerseyIcon jersey={s.jersey as JerseyKey} raceName={race.name} size={18} title={`Bærer ${s.jersey}-trøjen`} />
                        </span>
                      )}
                      {s.gc_position != null && s.gc_position <= 20 && (
                        <span
                          title="Sammenlagt placering"
                          style={{
                            marginLeft: 4, padding: '1px 5px', borderRadius: 2,
                            background: 'rgba(143,171,196,0.15)', color: '#8FABC4',
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                          }}
                        >GC {s.gc_position}</span>
                      )}
                    </>
                  )
                })()}
              </span>

              <div
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}
                onMouseEnter={() => { if (ROLE_TOOLTIPS[baseRole]) setHoveredRole(roleSlot.key) }}
                onMouseLeave={() => setHoveredRole(null)}
              >
                <span
                  onClick={(e) => {
                    if (!ROLE_TOOLTIPS[baseRole]) return
                    e.stopPropagation()
                    setPinnedRole((curr) => curr === roleSlot.key ? null : roleSlot.key)
                  }}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
                    color: 'rgba(255,255,255,0.5)', textAlign: 'right',
                    cursor: ROLE_TOOLTIPS[baseRole] ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                    borderBottom: ROLE_TOOLTIPS[baseRole] ? '1px dotted rgba(255,255,255,0.18)' : 'none',
                  }}
                >
                  {roleSlot.label}
                </span>
                {(() => {
                  const sb = getRoleStageBonus(baseRole, race.profile)
                  if (!sb.pillLabel) return null
                  const isHigh = sb.strength === 'high'
                  return (
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.06em',
                      padding: '1px 5px', borderRadius: 2,
                      background: isHigh ? 'rgba(107,143,113,0.22)' : 'rgba(143,171,196,0.15)',
                      color: isHigh ? '#9FE1CB' : '#8FABC4',
                      whiteSpace: 'nowrap',
                    }}>
                      {sb.pillLabel}
                    </span>
                  )
                })()}
                {(hoveredRole === roleSlot.key || pinnedRole === roleSlot.key) && ROLE_TOOLTIPS[baseRole] && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
                    background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 8,
                    padding: '10px 14px',
                    // Viewport-aware: aldrig bredere end skærmen minus 24px margin,
                    // så tooltip aldrig kan klippes af iPhone-kant. På desktop
                    // capper vi ved 320px så den ikke flyder for langt ud.
                    width: 'max-content',
                    minWidth: 220,
                    maxWidth: 'min(320px, calc(100vw - 24px))',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
                    color: 'rgba(255,255,255,0.78)', lineHeight: 1.5,
                    whiteSpace: 'normal',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
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
                    {isJokerDnf ? '0 pt (immun)' : `${fmt(score.total_points)} pt`}
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
              borderBottom: idx < roleSlots.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
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

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
                color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap',
              }}>
                {roleSlot.label}
              </span>
              {(() => {
                const sb = getRoleStageBonus(baseRole, race.profile)
                if (!sb.pillLabel) return null
                const isHigh = sb.strength === 'high'
                return (
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    padding: '1px 5px', borderRadius: 2,
                    background: isHigh ? 'rgba(107,143,113,0.18)' : 'rgba(143,171,196,0.12)',
                    color: isHigh ? '#9FE1CB' : '#8FABC4',
                    opacity: 0.85, whiteSpace: 'nowrap',
                  }}>
                    {sb.pillLabel}
                  </span>
                )
              })()}
            </div>

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
          display: 'flex', alignItems: 'center',
          padding: '10px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
            fontWeight: 600, color: 'rgba(255,255,255,0.35)',
          }}>
            Bænk — {benchScores.length} {benchScores.length === 1 ? 'rytter' : 'ryttere'} uden point
          </span>
        </div>
      )}
    </div>
  )
}
