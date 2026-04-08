'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

type Race = {
  id: string
  name: string
  start_date: string
  status: string
  race_type: string
  profile: string | null
  profile_image_url: string | null
  cycling_block_id: string | null
}

type Block = {
  id: string
  name: string
  block_order: number
  parent_block_id: string | null
  lock_deadline: string
}

type SquadRider = {
  id: string
  first_name: string
  last_name: string
  team_name: string
  category: number
  team_logo_url: string | null
  photo_url: string | null
}

type RoleKey = 'leader' | 'lieutenant' | 'grimpeur' | 'sprinter' | 'domestique' | 'equipier_0' | 'equipier_1' | 'joker'

type LineupState = Record<string, Record<RoleKey, string | null>>

type Props = {
  gameId: number
  blockSquadMap: Record<string, string>
  races: Race[]
  squadRiders: SquadRider[]
  blocks: Block[]
  defaultBlockId?: string | null
  lockDeadline?: string | null
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLES: { key: RoleKey; label: string; catRule: number[] | null }[] = [
  { key: 'leader',      label: 'Leader',     catRule: null },
  { key: 'lieutenant',  label: 'Lieutenant', catRule: [2, 3] },
  { key: 'grimpeur',    label: 'Grimpeur',   catRule: [3, 4, 5] },
  { key: 'sprinter',    label: 'Sprinter',   catRule: [1, 2, 3] },
  { key: 'domestique',  label: 'Domestique', catRule: [4] },
  { key: 'equipier_0',  label: 'Équipier',   catRule: null },
  { key: 'equipier_1',  label: 'Équipier',   catRule: null },
  { key: 'joker',       label: 'Joker',      catRule: null },
]

const EMPTY_SLOTS: Record<RoleKey, null> = {
  leader: null, lieutenant: null, grimpeur: null, sprinter: null,
  domestique: null, equipier_0: null, equipier_1: null, joker: null,
}

const PROFILE_LABELS: Record<string, string> = {
  cobbled: 'Brosten', mountain: 'Bjerg', hilly: 'Kuperet',
  flat: 'Flad', itt: 'Enkeltstart', mixed: 'Blandet',
}

const CAT_LABELS: Record<number, string> = { 1: 'Kat 1', 2: 'Kat 2', 3: 'Kat 3', 4: 'Kat 4', 5: 'Kat 5' }
const CAT_COLORS: Record<number, string> = {
  1: '#B8963E', 2: '#6B8F71', 3: '#4A6FA5', 4: '#8B6F47', 5: '#7A7060',
}

const SHORT_NAMES: Record<string, string> = {
  'Paris-Roubaix': 'Roubaix', 'Amstel Gold Race': 'Amstel',
  'La Flèche Wallonne': 'Flèche', 'Liège-Bastogne-Liège': 'Liège',
  'Ronde van Vlaanderen': 'Flandern', 'Milano-Sanremo': 'Sanremo',
  'Omloop Het Nieuwsblad': 'Omloop', 'Dwars door Vlaanderen': 'Dwars',
  'Itzulia Basque Country': 'Itzulia', 'Critérium du Dauphiné': 'Dauphiné',
  'Volta a Catalunya': 'Catalunya', 'Tour de Romandie': 'Romandie',
  'Tour de Suisse': 'Suisse', 'Eschborn-Frankfurt': 'Frankfurt',
  'GP Québec': 'Québec', 'GP Montréal': 'Montréal',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function CatBadge({ cat }: { cat: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 6px', borderRadius: 2,
      background: `${CAT_COLORS[cat] ?? '#7A7060'}18`,
      color: CAT_COLORS[cat] ?? '#7A7060',
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
      fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.4,
    }}>
      {CAT_LABELS[cat] ?? `K${cat}`}
    </span>
  )
}

function TeamLogo({ url, team }: { url: string | null; team: string }) {
  if (url) {
    return <img src={url} alt={team} style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 2, background: '#2B4F7A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 700, color: '#8FABC4', flexShrink: 0,
    }}>
      {team.slice(0, 2).toUpperCase()}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const d = new Date(dateStr)
  return `${d.getDate()}. ${months[d.getMonth()]}`
}

function formatDeadline(iso: string): string {
  const d = new Date(iso)
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()}. ${months[d.getMonth()]} kl. ${h}:${m}`
}

function shortName(name: string): string {
  return SHORT_NAMES[name] ?? name
}

function shortBlockName(name: string): string {
  // "Giro d'Italia — Uge 1 (Etape 1-7)" → "Giro Uge 1"
  const weekMatch = name.match(/^(.+?)\s*—\s*Uge\s*(\d+)/i)
  if (weekMatch) {
    const base = weekMatch[1]
      .replace(/d'Italia/i, '').replace(/de France/i, '').replace(/a España/i, '')
      .trim()
    return `${base} Uge ${weekMatch[2]}`
  }
  // "Flandern-klassikerne" → "Flandern"
  return name.replace(/-?klassikerne$/i, '').trim()
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LineupBuilder({ gameId, blockSquadMap, races, squadRiders, blocks, defaultBlockId, lockDeadline }: Props) {
  const sortedBlocks = useMemo(() =>
    [...blocks].sort((a, b) => a.block_order - b.block_order),
  [blocks])

  const sortedRaces = useMemo(() =>
    [...races].sort((a, b) => a.start_date.localeCompare(b.start_date)),
  [races])

  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    defaultBlockId ?? sortedBlocks[0]?.id ?? null
  )

  const blockRaces = useMemo(() =>
    activeBlockId ? sortedRaces.filter((r) => r.cycling_block_id === activeBlockId) : sortedRaces,
  [sortedRaces, activeBlockId])

  const defaultTabId = blockRaces.find((r) => r.status === 'upcoming')?.id ?? blockRaces[0]?.id ?? null

  const [activeTab, setActiveTab] = useState<string | null>(defaultTabId)

  // Reset race tab when block changes
  useEffect(() => {
    const firstUpcoming = blockRaces.find((r) => r.status === 'upcoming')?.id ?? blockRaces[0]?.id ?? null
    setActiveTab(firstUpcoming)
  }, [activeBlockId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [lineups, setLineups] = useState<LineupState>({})
  const [lockedRaces, setLockedRaces] = useState<Set<string>>(new Set())
  const [savingRace, setSavingRace] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState<{ raceId: string; roleKey: RoleKey } | null>(null)
  const [modalSearch, setModalSearch] = useState('')
  const [initialLineups, setInitialLineups] = useState<LineupState>({})

  const riderMap = useMemo(() => {
    const map = new Map<string, SquadRider>()
    for (const r of squadRiders) map.set(r.id, r)
    return map
  }, [squadRiders])

  // Derive current squad from active block
  const currentSquadId = activeBlockId ? blockSquadMap[activeBlockId] ?? null : null
  const hasAnySquad = Object.keys(blockSquadMap).length > 0

  // Fetch existing lineups on mount (fetches all lineups across squads)
  useEffect(() => {
    if (!hasAnySquad) return
    fetch(`/api/cycling-games/${gameId}/lineup`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.lineups?.length) return
        const state: LineupState = {}
        const locked = new Set<string>()
        for (const lineup of data.lineups) {
          const raceSlots: Record<RoleKey, string | null> = { ...EMPTY_SLOTS }
          if (lineup.is_locked) locked.add(lineup.race_id)
          for (const rider of lineup.riders) {
            let roleKey: RoleKey = rider.role as RoleKey
            if (rider.role === 'equipier') {
              roleKey = `equipier_${rider.slot_index}` as RoleKey
            }
            if (roleKey in raceSlots) {
              raceSlots[roleKey] = rider.rider_id
            }
          }
          state[lineup.race_id] = raceSlots
        }
        setLineups(state)
        setInitialLineups(JSON.parse(JSON.stringify(state)))
        setLockedRaces(locked)
      })
      .catch(() => {})
  }, [gameId, hasAnySquad]) // eslint-disable-line react-hooks/exhaustive-deps

  const setSlot = useCallback((raceId: string, roleKey: RoleKey, riderId: string | null) => {
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

  async function handleSave(raceId: string) {
    setError(null)
    setSuccess(null)
    setSavingRace(raceId)

    const slots = lineups[raceId]
    if (!slots) { setSavingRace(null); return }

    const riders: { rider_id: string; role: string; slot_index: number }[] = []
    for (const role of ROLES) {
      const riderId = slots[role.key]
      if (!riderId) continue
      const baseRole = role.key.startsWith('equipier_') ? 'equipier' : role.key
      const slotIndex = role.key.startsWith('equipier_') ? parseInt(role.key.split('_')[1]) : 0
      riders.push({ rider_id: riderId, role: baseRole, slot_index: slotIndex })
    }

    try {
      const res = await fetch(`/api/cycling-games/${gameId}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ race_id: raceId, riders }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Noget gik galt')
      } else {
        setSuccess(raceId)
        setInitialLineups((prev) => ({
          ...prev,
          [raceId]: JSON.parse(JSON.stringify(lineups[raceId])),
        }))
      }
    } catch {
      setError('Noget gik galt')
    }
    setSavingRace(null)
  }

  if (blocks.length === 0) return null

  const activeRace = blockRaces.find((r) => r.id === activeTab) ?? blockRaces[0] ?? null
  const activeBlock = sortedBlocks.find((b) => b.id === activeBlockId)

  // No squad for this block?
  const noSquadForBlock = !currentSquadId

  const isFinished = activeRace?.status === 'finished'
  const isLocked = activeRace ? lockedRaces.has(activeRace.id) : false
  const slots = activeRace ? (lineups[activeRace.id] ?? { ...EMPTY_SLOTS }) : { ...EMPTY_SLOTS }
  const changed = activeRace ? hasChanges(activeRace.id) : false
  const isSaving = activeRace ? savingRace === activeRace.id : false
  const isSuccess = activeRace ? success === activeRace.id : false
  const filledCount = Object.values(slots).filter((v) => v !== null).length
  const profileLabel = activeRace ? (PROFILE_LABELS[activeRace.profile ?? ''] ?? 'Endagsløb') : ''

  // Lock deadline: active block deadline > prop > race start_date - 30min
  const deadlineStr = activeBlock?.lock_deadline ?? lockDeadline ?? (activeRace ? (() => {
    const d = new Date(activeRace.start_date)
    d.setMinutes(d.getMinutes() - 30)
    return d.toISOString()
  })() : null)

  return (
    <div style={{ background: '#1E3A5F', borderRadius: 2, overflow: 'hidden' }}>
      {/* ── Niveau 1: Blok-tabs ────────────────────────────── */}
      {sortedBlocks.length > 0 && (
        <div
          className="scrollbar-hide"
          style={{
            display: 'flex',
            overflowX: 'auto',
            background: '#0F2137',
            padding: '8px 12px 0',
            gap: 0,
          }}
        >
          {sortedBlocks.map((block) => {
            const isActive = block.id === activeBlockId
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => setActiveBlockId(block.id)}
                style={{
                  padding: '8px 14px',
                  background: isActive ? '#1E3A5F' : 'transparent',
                  border: 'none',
                  borderRadius: isActive ? '6px 6px 0 0' : 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
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
              </button>
            )
          })}
        </div>
      )}

      {/* ── Niveau 2: Løbs-tabs + lineup content ──────────── */}
      {activeRace && (<>
      <div
        className="scrollbar-hide"
        style={{
          display: 'flex',
          overflowX: 'auto',
          background: '#162d4a',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: 0,
        }}
      >
        {blockRaces.map((race) => {
          const isActive = race.id === activeTab
          const isFinished = race.status === 'finished'
          const raceSlots = lineups[race.id]
          const filled = raceSlots ? Object.values(raceSlots).filter((v) => v !== null).length : 0
          return (
            <button
              key={race.id}
              type="button"
              onClick={() => setActiveTab(race.id)}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #4A90D9' : '2px solid transparent',
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
              }}>
                {shortName(race.name)}{isFinished ? ' ✓' : ''}
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

      {/* ── Race header ──────────────────────────────────────── */}
      {activeRace.profile_image_url && (
        <div style={{ width: '100%', maxHeight: 80, overflow: 'hidden' }}>
          <img
            src={activeRace.profile_image_url}
            alt={activeRace.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', filter: 'brightness(0.7)' }}
          />
        </div>
      )}

      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700,
            color: '#F2EDE4', lineHeight: 1.2,
          }}>
            {isLocked ? '🔒 ' : ''}{activeRace.name}
          </span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
            padding: '2px 6px', borderRadius: 2,
            background: filledCount === 8 ? 'rgba(107,143,113,0.25)' : 'rgba(255,255,255,0.08)',
            color: filledCount === 8 ? '#6B8F71' : 'rgba(255,255,255,0.4)',
          }}>
            {filledCount}/8
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {formatDate(activeRace.start_date)}
          </span>
          <span style={{
            padding: '1px 5px', borderRadius: 2,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 600,
          }}>
            {profileLabel}
          </span>
        </div>
        {deadlineStr && (
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
            color: '#ff6b6b', fontWeight: 600, marginTop: 4,
          }}>
            Låser {formatDeadline(deadlineStr)}
          </div>
        )}
      </div>

      {/* ── Finished placeholder ──────────────────────────── */}
      {isFinished && (
        <div style={{
          padding: '32px 14px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
            fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4,
          }}>
            Løbet er afsluttet
          </div>
          <div style={{
            fontFamily: "'Barlow', sans-serif", fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
          }}>
            Resultater kommer snart
          </div>
        </div>
      )}

      {/* ── No squad placeholder ──────────────────────────── */}
      {!isFinished && noSquadForBlock && (
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

      {/* ── Role slots ───────────────────────────────────────── */}
      {!isFinished && !noSquadForBlock && (<>
      <div>
        {ROLES.map((role, idx) => {
          const riderId = slots[role.key]
          const rider = riderId ? riderMap.get(riderId) : null

          return (
            <button
              key={role.key}
              type="button"
              disabled={isLocked}
              onClick={() => {
                if (isLocked) return
                setModalOpen({ raceId: activeRace.id, roleKey: role.key })
                setModalSearch('')
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px',
                background: 'transparent', border: 'none',
                borderBottom: idx < ROLES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.6 : 1,
                textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (!isLocked) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ width: 85, flexShrink: 0 }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em', whiteSpace: 'nowrap',
                }}>
                  {role.label}
                </span>
              </div>
              {rider ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <TeamLogo url={rider.team_logo_url} team={rider.team_name} />
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600,
                    color: '#F2EDE4', lineHeight: 1.2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {rider.first_name} {rider.last_name}
                  </span>
                  <CatBadge cat={rider.category} />
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontFamily: "'Barlow', sans-serif", fontSize: 12,
                    color: 'rgba(255,255,255,0.2)', fontStyle: 'italic',
                  }}>
                    Vælg rytter
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Save button ──────────────────────────────────────── */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          type="button"
          onClick={() => handleSave(activeRace.id)}
          disabled={!changed || isLocked || isSaving}
          style={{
            width: '100%', padding: '10px 0',
            border: 'none', borderRadius: 2,
            background: '#4A90D9',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#fff',
            cursor: !changed || isLocked || isSaving ? 'not-allowed' : 'pointer',
            opacity: !changed || isLocked || isSaving ? 0.35 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {isSaving ? 'Gemmer...' : isSuccess && !changed ? 'Gemt ✓' : 'Gem lineup'}
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

      {/* ── Modal ────────────────────────────────────────────── */}
      {modalOpen && (() => {
        const { raceId, roleKey } = modalOpen
        const role = ROLES.find((r) => r.key === roleKey)!
        const usedIds = getUsedRiderIds(raceId)

        const filteredRiders = squadRiders.filter((r) => {
          if (role.catRule && !role.catRule.includes(r.category)) return false
          if (modalSearch.trim()) {
            const q = modalSearch.toLowerCase()
            if (!r.first_name.toLowerCase().includes(q) && !r.last_name.toLowerCase().includes(q) && !r.team_name.toLowerCase().includes(q)) return false
          }
          return true
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: '#F2EDE4' }}>
                    {role.label}
                  </span>
                  {role.catRule && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#8FABC4' }}>
                      (kun Kat {role.catRule.join(', ')})
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

              {/* Search */}
              <div style={{ padding: '10px 16px' }}>
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
              </div>

              {/* Rider list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredRiders.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontFamily: "'Barlow', sans-serif", fontSize: 13 }}>
                    Ingen ryttere fundet
                  </div>
                ) : (
                  filteredRiders.map((rider, idx) => {
                    const alreadyUsed = usedIds.has(rider.id) && lineups[raceId]?.[roleKey] !== rider.id
                    return (
                      <button
                        key={rider.id} type="button" disabled={alreadyUsed}
                        title={alreadyUsed ? 'Allerede valgt i en anden rolle' : undefined}
                        onClick={() => { setSlot(raceId, roleKey, rider.id); setModalOpen(null) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '10px 16px',
                          background: 'transparent', border: 'none',
                          borderBottom: idx < filteredRiders.length - 1 ? '1px solid #1E3A5F' : 'none',
                          cursor: alreadyUsed ? 'not-allowed' : 'pointer',
                          opacity: alreadyUsed ? 0.35 : 1,
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
                        <CatBadge cat={rider.category} />
                      </button>
                    )
                  })
                )}
              </div>

              {/* Clear slot */}
              {lineups[modalOpen.raceId]?.[modalOpen.roleKey] && (
                <div style={{ borderTop: '1px solid #2B4F7A', padding: '8px 16px' }}>
                  <button
                    type="button"
                    onClick={() => { setSlot(modalOpen.raceId, modalOpen.roleKey, null); setModalOpen(null) }}
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
