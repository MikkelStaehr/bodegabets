'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Lock, Radio, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import LineupResults from './LineupResults'
import AllLineups from './AllLineups'
import { getBlockTheme } from '@/lib/cyclingBlockThemes'
import type { CyclingRace, CyclingBlock, CyclingSquadRider, CyclingStage, CyclingRoleKey } from '@/types/cycling'
import { formatCyclingDate, formatCyclingDeadline, shortRaceName, shortBlockName, PROFILE_LABELS, PROFILE_ICONS, RACE_TYPE_LABELS, CAT_LABELS, CAT_COLORS } from '@/lib/cyclingUtils'

// ── Types ───────────────────────────────────────────────────────────────────

type LineupState = Record<string, Record<CyclingRoleKey, string | null>>

type Props = {
  gameId: number
  blockSquadMap: Record<string, string>
  races: CyclingRace[]
  stages: CyclingStage[]
  startlists?: Record<string, string[]>  // race_id → rider_ids
  squadRiders: CyclingSquadRider[]
  blocks: CyclingBlock[]
  defaultBlockId?: string | null
  lockDeadline?: string | null
  squadRiderCount?: number
  squadId?: string | null
  currentUserId?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLES: { key: CyclingRoleKey; label: string; catRule: number[] | null }[] = [
  { key: 'leader',      label: 'Leader',     catRule: null },
  { key: 'lieutenant',  label: 'Lieutenant', catRule: [2, 3] },
  { key: 'grimpeur',    label: 'Grimpeur',   catRule: [3, 4, 5] },
  { key: 'sprinter',    label: 'Sprinter',   catRule: [1, 2, 3] },
  { key: 'domestique',  label: 'Domestique', catRule: [4] },
  { key: 'equipier_0',  label: 'Équipier',   catRule: null },
  { key: 'equipier_1',  label: 'Équipier',   catRule: null },
  { key: 'joker',       label: 'Joker',      catRule: null },
]

const EMPTY_SLOTS: Record<CyclingRoleKey, null> = {
  leader: null, lieutenant: null, grimpeur: null, sprinter: null,
  domestique: null, equipier_0: null, equipier_1: null, joker: null,
}

// Constants imported from @/lib/cyclingUtils

// ── Shared components ──────────────────────────────────────────────────────

import CatBadge from './CatBadge'
import TeamLogo from './TeamLogo'

// ── Scrollable tab bar ─────────────────────────────────────────────────────

function ScrollableTabs({ children, background }: { children: React.ReactNode; background: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [checkScroll])

  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  const btnStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 0,
    width: 28, height: 28, borderRadius: '50%',
    background: 'rgba(0,0,0,0.45)', border: 'none',
    color: '#fff', fontSize: 14, lineHeight: 1,
    cursor: 'pointer', zIndex: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  return (
    <div style={{ position: 'relative' }}>
      {canScrollLeft && (
        <button type="button" onClick={() => scroll(-1)} style={btnStyle('left')}><ChevronLeft size={14} /></button>
      )}
      <div
        ref={ref}
        style={{
          display: 'flex', overflowX: 'auto', gap: 0,
          background, scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
      {canScrollRight && (
        <button type="button" onClick={() => scroll(1)} style={btnStyle('right')}><ChevronRight size={14} /></button>
      )}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LineupBuilder({ gameId, blockSquadMap, races, stages, startlists, squadRiders, blocks, defaultBlockId, lockDeadline, squadRiderCount, squadId, currentUserId }: Props) {
  const sortedBlocks = useMemo(() =>
    [...blocks]
      .filter((b) => b.parent_block_id === null)
      .sort((a, b) => a.block_order - b.block_order),
  [blocks])

  const blockDateRange = useCallback((blockId: string) => {
    const br = races.filter((r) => r.cycling_block_id === blockId)
    if (!br.length) return ''
    const dates = br.map((r) => new Date(r.start_date)).sort((a, b) => +a - +b)
    const fmt = (d: Date) => {
      const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
      return `${d.getDate()}. ${months[d.getMonth()]}`
    }
    return dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])} — ${fmt(dates[dates.length - 1])}`
  }, [races])

  const sortedRaces = useMemo(() =>
    [...races].sort((a, b) => a.start_date.localeCompare(b.start_date)),
  [races])

  const sortedStages = useMemo(() =>
    [...stages].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.stage_number - b.stage_number),
  [stages])

  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    defaultBlockId ?? sortedBlocks[0]?.id ?? null
  )

  const blockStages = useMemo(() =>
    activeBlockId ? sortedStages.filter((s) => s.cycling_block_id === activeBlockId) : sortedStages,
  [sortedStages, activeBlockId])

  // Keep blockRaces for backward compat (block date range etc.)
  const blockRaces = useMemo(() =>
    activeBlockId ? sortedRaces.filter((r) => r.cycling_block_id === activeBlockId) : sortedRaces,
  [sortedRaces, activeBlockId])

  const defaultTabId = blockStages.find((s) => new Date(s.start_date) > new Date())?.id ?? blockStages[0]?.id ?? null

  const [activeTab, setActiveTab] = useState<string | null>(defaultTabId)

  // Reset stage tab when block changes
  useEffect(() => {
    const firstUpcoming = blockStages.find((s) => new Date(s.start_date) > new Date())?.id ?? blockStages[0]?.id ?? null
    setActiveTab(firstUpcoming)
  }, [activeBlockId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [lineups, setLineups] = useState<LineupState>({})
  const [lockedStages, setLockedStages] = useState<Set<string>>(new Set())
  const [savingStage, setSavingStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState<{ stageId: string; roleKey: CyclingRoleKey } | null>(null)
  const [modalSearch, setModalSearch] = useState('')
  const [showOnlyStarters, setShowOnlyStarters] = useState(false)
  const [initialLineups, setInitialLineups] = useState<LineupState>({})

  // Scores & results per race (for finished races)
  type ScoreEntry = { rider_id: string; role: string; is_bench: boolean; base_points: number; role_bonus: number; role_multiplier: number; jersey_points: number; team_bonus: number; bench_penalty: number; dnf_penalty: number; total_points: number }
  type ResultEntry = { rider_id: string; position: number | null; dnf: boolean; abandon_type: string | null; jersey: string | null }
  type LineupEntry = { rider_id: string; role: string; slot_index: number }
  const [raceScores, setRaceScores] = useState<Record<string, ScoreEntry[]>>({})
  const [raceResults, setRaceResults] = useState<Record<string, ResultEntry[]>>({})
  const [raceLineupRiders, setRaceLineupRiders] = useState<Record<string, LineupEntry[]>>({})

  const riderMap = useMemo(() => {
    const map = new Map<string, CyclingSquadRider>()
    for (const r of squadRiders) map.set(r.id, r)
    return map
  }, [squadRiders])

  // Derive current squad from active block
  const currentSquadId = activeBlockId ? blockSquadMap[activeBlockId] ?? null : null
  const hasAnySquad = Object.keys(blockSquadMap).length > 0

  // Fetch existing lineups on mount (fetches all lineups across squads)
  useEffect(() => {
    if (!hasAnySquad) return
    fetch(`/api/games/${gameId}/cycling/lineup`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.lineups?.length) return
        const state: LineupState = {}
        const locked = new Set<string>()
        for (const lineup of data.lineups) {
          const key = lineup.stage_id ?? lineup.race_id // stage_id is primary key
          const raceSlots: Record<CyclingRoleKey, string | null> = { ...EMPTY_SLOTS }
          if (lineup.is_locked) locked.add(key)
          for (const rider of lineup.riders) {
            let roleKey: CyclingRoleKey = rider.role as CyclingRoleKey
            if (rider.role === 'equipier') {
              roleKey = `equipier_${rider.slot_index}` as CyclingRoleKey
            }
            if (roleKey in raceSlots) {
              raceSlots[roleKey] = rider.rider_id
            }
          }
          state[key] = raceSlots
        }
        const scoresState: Record<string, ScoreEntry[]> = {}
        const resultsState: Record<string, ResultEntry[]> = {}
        const lineupRidersState: Record<string, LineupEntry[]> = {}
        for (const lineup of data.lineups) {
          const key = lineup.stage_id ?? lineup.race_id
          if (lineup.scores?.length) scoresState[key] = lineup.scores
          if (lineup.results?.length) resultsState[key] = lineup.results
          lineupRidersState[key] = lineup.riders.map((r: { rider_id: string; role: string; slot_index: number }) => ({
            rider_id: r.rider_id, role: r.role, slot_index: r.slot_index,
          }))
        }
        setLineups(state)
        setInitialLineups(JSON.parse(JSON.stringify(state)))
        setLockedStages(locked)
        setRaceScores(scoresState)
        setRaceResults(resultsState)
        setRaceLineupRiders(lineupRidersState)
      })
      .catch(() => {})
  }, [gameId, hasAnySquad]) // eslint-disable-line react-hooks/exhaustive-deps

  const setSlot = useCallback((raceId: string, roleKey: CyclingRoleKey, riderId: string | null) => {
    setLineups((prev) => ({
      ...prev,
      [raceId]: { ...(prev[raceId] ?? { ...EMPTY_SLOTS }), [roleKey]: riderId },
    }))
    setError(null)
    setSuccess(null)
  }, [])

  const getUsedRiderIds = useCallback((raceId: string): Set<string> => {
    const slots = lineups[raceId]
    if (!slots) return new Set()
    return new Set(Object.values(slots).filter((v): v is string => v !== null))
  }, [lineups])

  const hasChanges = useCallback((raceId: string): boolean => {
    return JSON.stringify(lineups[raceId]) !== JSON.stringify(initialLineups[raceId])
  }, [lineups, initialLineups])

  async function handleSave(stageId: string) {
    setError(null)
    setSuccess(null)
    setSavingStage(stageId)

    const slots = lineups[stageId]
    if (!slots) { setSavingStage(null); return }

    // Find the stage to get race_id
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) { setSavingStage(null); return }

    const riders: { rider_id: string; role: string; slot_index: number }[] = []
    for (const role of ROLES) {
      const riderId = slots[role.key]
      if (!riderId) continue
      const baseRole = role.key.startsWith('equipier_') ? 'equipier' : role.key
      const slotIndex = role.key.startsWith('equipier_') ? parseInt(role.key.split('_')[1]) : 0
      riders.push({ rider_id: riderId, role: baseRole, slot_index: slotIndex })
    }

    try {
      const res = await fetch(`/api/games/${gameId}/cycling/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ race_id: stage.race_id, stage_id: stageId, riders }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Noget gik galt')
      } else {
        setSuccess(stageId)
        setInitialLineups((prev) => ({
          ...prev,
          [stageId]: JSON.parse(JSON.stringify(lineups[stageId])),
        }))
      }
    } catch {
      setError('Noget gik galt')
    }
    setSavingStage(null)
  }

  if (blocks.length === 0) return null

  const activeStage = blockStages.find((s) => s.id === activeTab) ?? blockStages[0] ?? null
  const activeRace = activeStage ? races.find((r) => r.id === activeStage.race_id) ?? null : null
  const activeBlock = sortedBlocks.find((b) => b.id === activeBlockId)
  const theme = getBlockTheme(activeBlock?.name)

  // No squad for this block?
  const noSquadForBlock = !currentSquadId

  const isStageRace = activeStage?.race_type === 'stage_race'
  const isFinished = activeRace?.status === 'finished'
  const isLocked = activeStage ? lockedStages.has(activeStage.id) : false
  const slots = activeStage ? (lineups[activeStage.id] ?? { ...EMPTY_SLOTS }) : { ...EMPTY_SLOTS }
  const changed = activeStage ? hasChanges(activeStage.id) : false
  const isSaving = activeStage ? savingStage === activeStage.id : false
  const isSuccess = activeStage ? success === activeStage.id : false
  const filledCount = Object.values(slots).filter((v) => v !== null).length
  const profileLabel = activeStage ? (PROFILE_LABELS[activeStage.profile ?? ''] ?? 'Endagsløb') : ''

  // Lock deadline: stage start_date - 30min (dato-only bliver tolket som 09:00 UTC)
  const deadlineStr = activeStage ? (() => {
    const startStr = /^\d{4}-\d{2}-\d{2}$/.test(activeStage.start_date)
      ? `${activeStage.start_date}T09:00:00Z`
      : activeStage.start_date
    const d = new Date(startStr)
    d.setMinutes(d.getMinutes() - 30)
    return d.toISOString()
  })() : (lockDeadline ?? null)

  return (
    <div style={{ background: theme.bg, borderRadius: 2, overflow: 'hidden', transition: 'background 0.3s' }}>
      {/* ── Stripes bar (VM, EM osv.) ────────────────────────── */}
      {theme.stripes && (
        <div style={{ display: 'flex', height: 4 }}>
          {theme.stripes.map((color, i) => (
            <div key={i} style={{ flex: 1, background: color }} />
          ))}
        </div>
      )}

      {/* ── Niveau 1: Blok-tabs ────────────────────────────── */}
      {sortedBlocks.length > 0 && (
        <ScrollableTabs background="#0F2137">
          <div style={{ display: 'flex', padding: '8px 12px 0', gap: 0 }}>
          {sortedBlocks.map((block) => {
            const isActive = block.id === activeBlockId
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => setActiveBlockId(block.id)}
                style={{
                  padding: '8px 14px 6px',
                  background: isActive ? theme.bg : 'transparent',
                  border: 'none',
                  borderRadius: isActive ? '6px 6px 0 0' : 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#F2EDE4' : 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {shortBlockName(block.name)}
                </span>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.3)',
                }}>
                  {blockDateRange(block.id)}
                </span>
              </button>
            )
          })}
          </div>
        </ScrollableTabs>
      )}

      {/* ── Niveau 2: Stage-tabs + lineup content ──────────── */}
      {activeStage && (<>
      <ScrollableTabs background={theme.bgDark}>
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
        {blockStages.map((stage) => {
          const isActive = stage.id === activeTab
          const stageRace = races.find((r) => r.id === stage.race_id)
          const isFinished = stageRace?.status === 'finished'
          // Live: enten DB status 'active', eller start-tidspunkt er passeret og ikke finished
          const startStr = /^\d{4}-\d{2}-\d{2}$/.test(stage.start_date)
            ? `${stage.start_date}T09:00:00Z`
            : stage.start_date
          const hasStarted = new Date(startStr) <= new Date()
          const isLive = stageRace?.status === 'active' || (hasStarted && !isFinished)
          const stageLocked = lockedStages.has(stage.id)
          const stageSlots = lineups[stage.id]
          const filled = stageSlots ? Object.values(stageSlots).filter((v) => v !== null).length : 0
          // One-day races: show race short name. Stage races: show "Etape N"
          const tabLabel = stage.race_type === 'one_day'
            ? shortRaceName(stage.race_name)
            : `Etape ${stage.stage_number}`
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveTab(stage.id)}
              style={{
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#F2EDE4' : isFinished ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)',
                letterSpacing: '0.01em',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                {tabLabel}
                {isLive && (
                  <Radio size={11} color="#D83A3A" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
                )}
                {isFinished && <Check size={11} />}
                {!isLive && !isFinished && stageLocked && (
                  <Lock size={10} color="#ff6b6b" />
                )}
              </span>
              {filled > 0 && (
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, fontWeight: 700,
                  color: filled === 8 ? '#6B8F71' : 'rgba(255,255,255,0.3)',
                }}>
                  {filled}/8
                </span>
              )}
            </button>
          )
        })}
        </div>
      </ScrollableTabs>

      {/* ── Brutto trup bar (per blok) ────────────────────── */}
      {(() => {
        const ab = sortedBlocks.find((b) => b.id === activeBlockId)
        const blockLabel = ab ? shortBlockName(ab.name) : ''
        const hasSquadForBlock = !!(activeBlockId && blockSquadMap[activeBlockId])
        const squadLink = `/games/${gameId}/squad${activeBlockId ? `?block=${activeBlockId}` : ''}`

        return hasSquadForBlock ? (
          <a
            href={squadLink}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              background: theme.bgDark,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              textDecoration: 'none',
            }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600,
              color: '#F2EDE4',
            }}>
              Din brutto trup{blockLabel ? ` — ${blockLabel}` : ''}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 999,
              background: 'rgba(107,143,113,0.25)', color: '#6B8F71',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
            }}>
              {squadRiderCount ?? 0}/25 ryttere
            </span>
          </a>
        ) : (
          <a
            href={squadLink}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              background: theme.bgDark,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              textDecoration: 'none',
            }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
            }}>
              Udtag brutto trup{blockLabel ? ` — ${blockLabel}` : ''}
            </span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 600,
              color: theme.accent,
            }}>
              Udtag trup →
            </span>
          </a>
        )
      })()}

      {/* ── Race/Stage header ──────────────────────────────── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {(activeStage.race_profile_image_url || activeRace?.race_photo_url) && (
          <>
            <img
              src={activeStage.race_profile_image_url ?? activeRace?.race_photo_url ?? ''}
              alt=""
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center',
              }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(to right, ${theme.bg}F5 0%, ${theme.bg}CC 40%, ${theme.bg}55 100%)`,
            }} />
          </>
        )}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '12px 16px',
          background: (activeStage.race_profile_image_url || activeRace?.race_photo_url) ? 'transparent' : theme.bg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {activeRace?.logo_url ? (
              <img
                src={activeRace.logo_url}
                alt={activeStage.race_name}
                style={{
                  height: 64, width: 'auto', maxWidth: 160,
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 500,
                color: '#F2EDE4', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {isStageRace ? `${activeStage.race_name} — Etape ${activeStage.stage_number}` : activeStage.race_name}
              </span>
            )}
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 2, flexShrink: 0, marginLeft: 'auto',
              background: filledCount === 8 ? 'rgba(107,143,113,0.25)' : 'rgba(255,255,255,0.08)',
              color: filledCount === 8 ? '#6B8F71' : 'rgba(255,255,255,0.4)',
            }}>
              {filledCount}/8
            </span>
          </div>
          {/* ── Route line: departure → arrival ────────────── */}
          {(activeStage.departure || activeStage.arrival) && (
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
              color: '#F2EDE4', marginBottom: 6, fontWeight: 500,
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}>
              {activeStage.departure && activeStage.arrival
                ? `${activeStage.departure} → ${activeStage.arrival}`
                : activeStage.departure ?? activeStage.arrival}
            </div>
          )}

          {/* ── Info pills row ──────────────────────────────── */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
          }}>
            {[
              formatCyclingDate(activeStage.start_date),
              activeStage.profile && profileLabel ? `${PROFILE_ICONS[activeStage.profile ?? ''] ?? ''} ${profileLabel}` : null,
              activeStage.distance_km != null && activeStage.distance_km > 0 ? `${activeStage.distance_km} km` : null,
              activeStage.vertical_meters != null && activeStage.vertical_meters > 0 ? `↑ ${activeStage.vertical_meters.toLocaleString()} m` : null,
              activeStage.profile_score != null && activeStage.profile_score > 0 ? `PS ${activeStage.profile_score}` : null,
            ].filter(Boolean).map((text, i) => (
              <span key={i} style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 2,
                background: `${theme.bg}CC`, color: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(4px)',
              }}>
                {text}
              </span>
            ))}
          </div>
          {deadlineStr && (
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
              color: '#ff6b6b', fontWeight: 600, marginTop: 6,
            }}>
              Låser {formatCyclingDeadline(deadlineStr)}
            </div>
          )}
        </div>
      </div>

      {/* ── No squad placeholder ──────────────────────────── */}
      {noSquadForBlock && (
        <div style={{ padding: '24px 14px', textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: 'rgba(255,255,255,0.5)', marginBottom: 8,
          }}>
            Udtag din brutto trup for at sætte lineup
          </div>
          <a
            href={`/games/${gameId}/squad${activeBlockId ? `?block=${activeBlockId}` : ''}`}
            style={{
              display: 'inline-block', padding: '8px 20px',
              background: '#4A90D9', border: 'none', borderRadius: 2,
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#fff', textDecoration: 'none', cursor: 'pointer',
            }}
          >
            Udtag brutto trup
          </a>
        </div>
      )}

      {/* ── Lineup results view ──────────────────────────────── */}
      {!noSquadForBlock && activeStage && activeRace && (
        <LineupResults
          race={activeRace}
          slots={slots}
          scores={raceScores[activeStage.id] ?? []}
          results={raceResults[activeStage.id] ?? []}
          riders={squadRiders}
          onEditRole={!isFinished && !isLocked ? (roleKey) => {
            setModalOpen({ stageId: activeStage.id, roleKey: roleKey as CyclingRoleKey })
            setModalSearch('')
          } : undefined}
        />
      )}

      {/* ── Save button ──────────────────────────────────────── */}
      {!noSquadForBlock && !isFinished && activeStage && (<>
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          type="button"
          onClick={() => handleSave(activeStage.id)}
          disabled={!changed || isLocked || isSaving}
          style={{
            width: '100%', padding: '10px 0',
            border: 'none', borderRadius: 2,
            background: theme.accent,
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#fff',
            cursor: !changed || isLocked || isSaving ? 'not-allowed' : 'pointer',
            opacity: !changed || isLocked || isSaving ? 0.35 : 1,
            transition: 'opacity 0.15s',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {isSaving ? 'Gemmer...' : isSuccess && !changed ? <>Gemt <Check size={14} /></> : 'Gem lineup'}
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
          fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#ff6b6b',
        }}>
          {error}
        </div>
      )}
      </>)}

      {/* ── Alle lineups (vises når lineup er låst / race er live/finished) ─── */}
      {activeStage && currentUserId && (isLocked || isFinished || (() => {
        const startStr = /^\d{4}-\d{2}-\d{2}$/.test(activeStage.start_date)
          ? `${activeStage.start_date}T09:00:00Z`
          : activeStage.start_date
        const deadline = new Date(new Date(startStr).getTime() - 30 * 60 * 1000)
        return deadline < new Date()
      })()) && (
        <div style={{ padding: '0 14px 14px' }}>
          <AllLineups gameId={gameId} stageId={activeStage.id} currentUserId={currentUserId} />
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────── */}
      {modalOpen && (() => {
        const { stageId, roleKey } = modalOpen
        const role = ROLES.find((r) => r.key === roleKey)!
        const usedIds = getUsedRiderIds(stageId)

        // Find race_id for den aktive stage, og hent startliste
        const modalStage = stages.find((s) => s.id === stageId)
        const startlistIds = modalStage && startlists?.[modalStage.race_id] ? new Set(startlists[modalStage.race_id]) : null
        const hasStartlist = startlistIds !== null && startlistIds.size > 0

        // Sort: startliste-ryttere først, så andre
        const filteredRiders = squadRiders
          .filter((r) => {
            if (role.catRule && !role.catRule.includes(r.category)) return false
            if (hasStartlist && showOnlyStarters && !startlistIds!.has(r.id)) return false
            if (modalSearch.trim()) {
              const q = modalSearch.toLowerCase()
              if (!r.first_name.toLowerCase().includes(q) && !r.last_name.toLowerCase().includes(q) && !r.team_name.toLowerCase().includes(q)) return false
            }
            return true
          })
          .sort((a, b) => {
            if (!hasStartlist) return 0
            const aStarts = startlistIds!.has(a.id) ? 1 : 0
            const bStarts = startlistIds!.has(b.id) ? 1 : 0
            return bStarts - aStarts
          })

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setModalOpen(null)}
          >
            <div
              style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '100%', maxWidth: 480, maxHeight: '70vh',
                background: '#0F2137', border: '1px solid #2B4F7A', borderRadius: 8,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid #2B4F7A',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: '#F2EDE4' }}>
                    {role.label}
                  </span>
                  {role.catRule && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#8FABC4' }}>
                      (kun Kat {role.catRule.join(', ')})
                    </span>
                  )}
                  {hasStartlist && (
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(107,143,113,0.2)', color: '#8FBF8F',
                      letterSpacing: '0.04em',
                    }}>
                      {squadRiders.filter((r) => startlistIds!.has(r.id)).length} starter
                    </span>
                  )}
                </div>
                <button
                  type="button" onClick={() => setModalOpen(null)}
                  style={{ background: 'none', border: 'none', color: '#8FABC4', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {/* Search + filter */}
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text" value={modalSearch} onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Søg rytter eller hold..." autoFocus
                  style={{
                    width: '100%', padding: '8px 12px',
                    border: '1px solid #2B4F7A', borderRadius: 2,
                    fontFamily: "'Barlow', sans-serif", fontSize: 13,
                    outline: 'none', background: '#1E3A5F', color: '#F2EDE4',
                  }}
                />
                {hasStartlist && (
                  <button
                    type="button"
                    onClick={() => setShowOnlyStarters((v) => !v)}
                    style={{
                      padding: '6px 12px', border: `1px solid ${showOnlyStarters ? '#8FBF8F' : '#2B4F7A'}`,
                      borderRadius: 2, cursor: 'pointer',
                      background: showOnlyStarters ? 'rgba(107,143,113,0.2)' : 'transparent',
                      color: showOnlyStarters ? '#8FBF8F' : '#8FABC4',
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.06em', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 2,
                      border: `1.5px solid ${showOnlyStarters ? '#8FBF8F' : '#5A7896'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: showOnlyStarters ? '#8FBF8F' : 'transparent',
                      flexShrink: 0,
                    }}>
                      {showOnlyStarters && <span style={{ color: '#0F2137', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </span>
                    Vis kun bekræftede startere
                  </button>
                )}
              </div>

              {/* Rider list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredRiders.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontFamily: "'Barlow', sans-serif", fontSize: 13 }}>
                    Ingen ryttere fundet
                  </div>
                ) : (
                  filteredRiders.map((rider, idx) => {
                    const alreadyUsed = usedIds.has(rider.id) && lineups[stageId]?.[roleKey] !== rider.id
                    const isOnStartlist = hasStartlist ? startlistIds!.has(rider.id) : null
                    const dimmed = alreadyUsed || (hasStartlist && !isOnStartlist)
                    return (
                      <button
                        key={rider.id} type="button" disabled={alreadyUsed}
                        title={alreadyUsed ? 'Allerede valgt i en anden rolle' : (hasStartlist && !isOnStartlist ? 'Starter ikke i dette løb' : undefined)}
                        onClick={() => { setSlot(stageId, roleKey, rider.id); setModalOpen(null) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '10px 16px',
                          background: 'transparent', border: 'none',
                          borderBottom: idx < filteredRiders.length - 1 ? '1px solid #1E3A5F' : 'none',
                          cursor: alreadyUsed ? 'not-allowed' : 'pointer',
                          opacity: alreadyUsed ? 0.35 : (hasStartlist && !isOnStartlist ? 0.5 : 1),
                          textAlign: 'left', transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => { if (!alreadyUsed) e.currentTarget.style.background = '#1E3A5F' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <TeamLogo url={rider.team_logo_url} team={rider.team_name} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600,
                            color: '#F2EDE4', lineHeight: 1.2,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {rider.last_name}
                            <span style={{ fontWeight: 400, color: '#8FABC4' }}> {rider.first_name}</span>
                          </div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#64748B', lineHeight: 1.2 }}>
                            {rider.team_name}
                          </div>
                        </div>
                        {hasStartlist && (
                          isOnStartlist ? (
                            <span style={{
                              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700,
                              padding: '2px 6px', borderRadius: 4,
                              background: 'rgba(107,143,113,0.2)', color: '#8FBF8F',
                              letterSpacing: '0.04em',
                            }}>STARTER</span>
                          ) : (
                            <span style={{
                              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700,
                              padding: '2px 6px', borderRadius: 4,
                              background: 'rgba(220,120,120,0.15)', color: '#D89090',
                              letterSpacing: '0.04em',
                            }}>—</span>
                          )
                        )}
                        <CatBadge cat={rider.category} />
                      </button>
                    )
                  })
                )}
              </div>

              {/* Clear slot */}
              {lineups[modalOpen.stageId]?.[modalOpen.roleKey] && (
                <div style={{ borderTop: '1px solid #2B4F7A', padding: '8px 16px' }}>
                  <button
                    type="button"
                    onClick={() => { setSlot(modalOpen.stageId, modalOpen.roleKey, null); setModalOpen(null) }}
                    style={{
                      width: '100%', padding: '8px 0', background: 'none', border: 'none',
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600,
                      color: '#ff6b6b', cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    Fjern rytter fra slot
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
      </>)}
    </div>
  )
}
