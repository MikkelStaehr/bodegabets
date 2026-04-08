'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ───────────────────────────────────────────────────────────────────

export type Rider = {
  id: string
  first_name: string
  last_name: string
  team_name: string
  category: number
  team_logo_url: string | null
  photo_url: string | null
}

export type RaceStartlist = {
  raceId: string
  raceName: string
  riderIds: string[]
}

type Props = {
  gameId: number
  availableRiders: Rider[]
  raceStartlists: RaceStartlist[]
  initialSquad: Rider[]
  blockId: string | null
  blockRaceIds: string[]
}

// Short race name aliases
const RACE_SHORT_NAMES: Record<string, string> = {
  'Paris-Roubaix': 'Roubaix',
  'Amstel Gold Race': 'Amstel',
  'La Flèche Wallonne': 'Flèche',
  'Liège-Bastogne-Liège': 'Liège',
  'Ronde van Vlaanderen': 'Flandern',
  'Milano-Sanremo': 'Sanremo',
  'Tour de France': 'Tour',
  "Giro d'Italia": 'Giro',
  'Vuelta a España': 'Vuelta',
  'Omloop Het Nieuwsblad': 'Omloop',
  'Strade Bianche': 'Strade',
  'E3 Classic': 'E3',
  'Gent-Wevelgem': 'Wevelgem',
  'Dwars door Vlaanderen': 'Dwars',
  'Eschborn-Frankfurt': 'Frankfurt',
  'San Sebastián': 'San Seb.',
  'Bretagne Classic': 'Bretagne',
  'GP Québec': 'Québec',
  'GP Montréal': 'Montréal',
  'Il Lombardia': 'Lombardia',
  'World Championships': 'VM',
  'European Championships': 'EM',
  'Itzulia Basque Country': 'Itzulia',
  'Critérium du Dauphiné': 'Dauphiné',
  'Volta a Catalunya': 'Catalunya',
  'Tour de Romandie': 'Romandie',
  'Tour de Suisse': 'Suisse',
  'Paris-Nice': 'Paris-Nice',
  'Tirreno-Adriatico': 'Tirreno',
}

function shortRaceName(name: string): string {
  return RACE_SHORT_NAMES[name] ?? (name.length > 10 ? name.slice(0, 8) + '...' : name)
}

// ── Constants ───────────────────────────────────────────────────────────────

const CAT_LIMITS: Record<number, number> = { 1: 3, 2: 5, 3: 5, 4: 5, 5: 7 }
const MAX_TOTAL = 25
const MAX_PER_TEAM = 3
const CAT_LABELS: Record<number, string> = {
  1: 'Kat 1',
  2: 'Kat 2',
  3: 'Kat 3',
  4: 'Kat 4',
  5: 'Kat 5',
}
const CAT_COLORS: Record<number, string> = {
  1: '#B8963E',
  2: '#6B8F71',
  3: '#4A6FA5',
  4: '#8B6F47',
  5: '#7A7060',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function CatBadge({ cat }: { cat: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1px 6px',
        borderRadius: 2,
        background: `${CAT_COLORS[cat] ?? '#7A7060'}18`,
        color: CAT_COLORS[cat] ?? '#7A7060',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        lineHeight: 1.4,
      }}
    >
      {CAT_LABELS[cat] ?? `K${cat}`}
    </span>
  )
}

function TeamLogo({ url, team }: { url: string | null; team: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={team}
        style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: 2,
        background: '#E8E0D3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 8,
        fontWeight: 700,
        color: '#9E9486',
        flexShrink: 0,
      }}
    >
      {team.slice(0, 2).toUpperCase()}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SquadBuilder({ gameId, availableRiders, raceStartlists, initialSquad, blockId, blockRaceIds }: Props) {
  const router = useRouter()
  const [squad, setSquad] = useState<Rider[]>(initialSquad)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<number | null>(null)
  const [confirmedOnly, setConfirmedOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Build per-rider race lookup: rider_id → list of short race names
  // Filter to only block races if blockRaceIds is provided
  const riderRaces = useMemo(() => {
    const blockSet = blockRaceIds.length > 0 ? new Set(blockRaceIds) : null
    const filtered = blockSet ? raceStartlists.filter((rs) => blockSet.has(rs.raceId)) : raceStartlists
    const map = new Map<string, string[]>()
    for (const rs of filtered) {
      const short = shortRaceName(rs.raceName)
      for (const rid of rs.riderIds) {
        const arr = map.get(rid) ?? []
        arr.push(short)
        map.set(rid, arr)
      }
    }
    return map
  }, [raceStartlists, blockRaceIds])

  // Bekræftede ryttere: baseret på filtrerede startlister (blok-scoped)
  const confirmedSet = useMemo(() => {
    const blockSet = blockRaceIds.length > 0 ? new Set(blockRaceIds) : null
    const filtered = blockSet ? raceStartlists.filter((sl) => blockSet.has(sl.raceId)) : raceStartlists
    return new Set(filtered.flatMap((sl) => sl.riderIds))
  }, [raceStartlists, blockRaceIds])
  const squadIds = useMemo(() => new Set(squad.map((r) => r.id)), [squad])

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of squad) counts[r.category] = (counts[r.category] ?? 0) + 1
    return counts
  }, [squad])

  // Team counts
  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of squad) counts[r.team_name] = (counts[r.team_name] ?? 0) + 1
    return counts
  }, [squad])

  // Filtered available riders
  const filtered = useMemo(() => {
    let list = availableRiders.filter((r) => !squadIds.has(r.id))
    if (confirmedOnly) list = list.filter((r) => confirmedSet.has(r.id))
    if (catFilter !== null) list = list.filter((r) => r.category === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) =>
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q) ||
          r.team_name.toLowerCase().includes(q)
      )
    }
    return list
  }, [availableRiders, squadIds, catFilter, search, confirmedOnly, confirmedSet])

  function canAdd(rider: Rider): { ok: boolean; reason?: string } {
    if (squad.length >= MAX_TOTAL) return { ok: false, reason: `Max ${MAX_TOTAL} ryttere` }
    if ((catCounts[rider.category] ?? 0) >= (CAT_LIMITS[rider.category] ?? 0)) {
      return { ok: false, reason: `${CAT_LABELS[rider.category]} er fuld` }
    }
    if ((teamCounts[rider.team_name] ?? 0) >= MAX_PER_TEAM) {
      return { ok: false, reason: `Max ${MAX_PER_TEAM} fra ${rider.team_name}` }
    }
    return { ok: true }
  }

  function addRider(rider: Rider) {
    const check = canAdd(rider)
    if (!check.ok) return
    setSquad((prev) => [...prev, rider])
    setSuccess(false)
  }

  function removeRider(riderId: string) {
    setSquad((prev) => prev.filter((r) => r.id !== riderId))
    setSuccess(false)
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/cycling-games/${gameId}/squad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rider_ids: squad.map((r) => r.id), cycling_block_id: blockId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Noget gik galt')
        setSaving(false)
        return
      }
      router.push(`/games/${gameId}`)
    } catch {
      setError('Noget gik galt')
      setSaving(false)
    }
  }

  return (
    <div>
      {/* ── Regler ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 8,
          padding: '8px 12px',
          background: '#F8F7F4',
          border: '1px solid #E5E0D8',
          borderRadius: 8,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 12,
          color: '#6B6560',
        }}
      >
        <span>Max 3 × Kat 1</span>
        <span>Max 5 × Kat 2</span>
        <span>Max 5 × Kat 3</span>
        <span>Max 5 × Kat 4</span>
        <span>Max 7 × Kat 5</span>
        <span>Max 3 fra samme hold</span>
      </div>

      {/* ── Category counter ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 16,
          padding: '12px 14px',
          background: '#FDFAF5',
          border: '1px solid #E8E0D3',
          borderRadius: 2,
        }}
      >
        {[1, 2, 3, 4, 5].map((cat) => {
          const count = catCounts[cat] ?? 0
          const limit = CAT_LIMITS[cat]
          const full = count >= limit
          return (
            <div
              key={cat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 2,
                background: full ? `${CAT_COLORS[cat]}18` : 'transparent',
                border: `1px solid ${full ? CAT_COLORS[cat] : '#E8E0D3'}`,
              }}
            >
              <CatBadge cat={cat} />
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color: full ? CAT_COLORS[cat] : '#6b6b6b',
                }}
              >
                {count}/{limit}
              </span>
            </div>
          )
        })}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: squad.length === MAX_TOTAL ? '#1E3A5F' : '#9E9486',
          }}
        >
          {squad.length}/{MAX_TOTAL}
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────── */}
      <style>{`@media (min-width: 640px) { .squad-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>
      <div className="squad-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

        {/* ── Brutto trup ─────────────────────────────────────────── */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#6b6b6b',
              }}
            >
              Din brutto trup
            </span>
          </div>

          <div
            style={{
              background: '#FDFAF5',
              border: '1px solid #E8E0D3',
              borderRadius: 2,
              minHeight: 200,
            }}
          >
            {squad.length === 0 ? (
              <div
                style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#9E9486',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 13,
                }}
              >
                Ingen ryttere valgt endnu
              </div>
            ) : (
              squad.map((rider, idx) => (
                <button
                  key={rider.id}
                  type="button"
                  onClick={() => removeRider(rider.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 12px',
                    borderBottom: idx < squad.length - 1 ? '1px solid #E8E0D3' : 'none',
                    background: 'transparent',
                    border: 'none',
                    borderBottomStyle: idx < squad.length - 1 ? 'solid' : 'none',
                    borderBottomWidth: idx < squad.length - 1 ? 1 : 0,
                    borderBottomColor: '#E8E0D3',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5ece0' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <TeamLogo url={rider.team_logo_url} team={rider.team_name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1a1a1a',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {rider.last_name}
                      <span style={{ fontWeight: 400, color: '#6b6b6b' }}> {rider.first_name}</span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 10,
                        color: '#9E9486',
                        lineHeight: 1.2,
                      }}
                    >
                      {rider.team_name}
                    </div>
                  </div>
                  <CatBadge cat={rider.category} />
                  <span
                    style={{
                      fontSize: 14,
                      color: '#C8392B',
                      fontWeight: 700,
                      flexShrink: 0,
                      width: 20,
                      textAlign: 'center',
                    }}
                  >
                    ×
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Tilgængelige ryttere ─────────────────────────────────── */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#6b6b6b',
              }}
            >
              Tilgængelige ryttere
            </span>
          </div>

          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg rytter eller hold..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #D4CFC4',
                borderRadius: 2,
                fontFamily: "'Barlow', sans-serif",
                fontSize: 13,
                outline: 'none',
                background: '#fff',
                color: '#1a1a1a',
              }}
            />
          </div>

          {/* Category filter pills + confirmed toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setCatFilter(null)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${catFilter === null ? '#1E3A5F' : '#D4CFC4'}`,
                background: catFilter === null ? '#1E3A5F' : 'transparent',
                color: catFilter === null ? '#F2EDE4' : '#6b6b6b',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Alle
            </button>
            {[1, 2, 3, 4, 5].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: `1px solid ${catFilter === cat ? CAT_COLORS[cat] : '#D4CFC4'}`,
                  background: catFilter === cat ? `${CAT_COLORS[cat]}18` : 'transparent',
                  color: catFilter === cat ? CAT_COLORS[cat] : '#6b6b6b',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {CAT_LABELS[cat]}
              </button>
            ))}
            {raceStartlists.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmedOnly(!confirmedOnly)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: `1px solid ${confirmedOnly ? '#4CAF50' : '#D4CFC4'}`,
                  background: confirmedOnly ? 'rgba(76,175,80,0.1)' : 'transparent',
                  color: confirmedOnly ? '#4CAF50' : '#6b6b6b',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Bekræftede
              </button>
            )}
          </div>

          {/* Rider list */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #D4CFC4',
              borderRadius: 2,
              maxHeight: 480,
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: '#9E9486',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 13,
                }}
              >
                Ingen ryttere fundet
              </div>
            ) : (
              filtered.map((rider, idx) => {
                const check = canAdd(rider)
                const disabled = !check.ok
                return (
                  <button
                    key={rider.id}
                    type="button"
                    onClick={() => addRider(rider)}
                    disabled={disabled}
                    title={disabled ? check.reason : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      borderBottom: idx < filtered.length - 1 ? '1px solid #EDE8E0' : 'none',
                      background: 'transparent',
                      border: 'none',
                      borderBottomStyle: idx < filtered.length - 1 ? 'solid' : 'none',
                      borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                      borderBottomColor: '#EDE8E0',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#FDFAF5' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <TeamLogo url={rider.team_logo_url} team={rider.team_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1a1a1a',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {rider.last_name}
                        <span style={{ fontWeight: 400, color: '#6b6b6b' }}> {rider.first_name}</span>
                      </div>
                      <div
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 10,
                          color: '#9E9486',
                          lineHeight: 1.2,
                        }}
                      >
                        {rider.team_name}
                      </div>
                    </div>
                    {riderRaces.has(rider.id) && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', flexShrink: 0 }}>
                        {riderRaces.get(rider.id)!.map((raceName) => (
                          <span
                            key={raceName}
                            style={{
                              padding: '1px 5px',
                              borderRadius: 2,
                              background: 'rgba(76,175,80,0.1)',
                              color: '#4CAF50',
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: 8,
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {raceName} ✓
                          </span>
                        ))}
                      </div>
                    )}
                    <CatBadge cat={rider.category} />
                    <span
                      style={{
                        fontSize: 16,
                        color: '#1E3A5F',
                        fontWeight: 700,
                        flexShrink: 0,
                        width: 20,
                        textAlign: 'center',
                      }}
                    >
                      +
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Error / Success ───────────────────────────────────────── */}
      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'rgba(200,57,43,0.08)',
            border: '1px solid rgba(200,57,43,0.3)',
            borderRadius: 2,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 13,
            color: '#C8392B',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'rgba(30,58,95,0.08)',
            border: '1px solid rgba(30,58,95,0.3)',
            borderRadius: 2,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 13,
            color: '#1E3A5F',
          }}
        >
          Trup gemt!
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button
          type="button"
          onClick={() => router.push(`/games/${gameId}`)}
          style={{
            padding: '10px 20px',
            border: '1px solid #D4CFC4',
            borderRadius: 2,
            background: 'transparent',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#6b6b6b',
            cursor: 'pointer',
          }}
        >
          Tilbage
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={squad.length === 0 || saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 24px',
            border: 'none',
            borderRadius: 2,
            background: '#1E3A5F',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#F2EDE4',
            cursor: squad.length === 0 || saving ? 'not-allowed' : 'pointer',
            opacity: squad.length === 0 || saving ? 0.4 : 1,
          }}
        >
          {saving && <Spinner />}
          {saving ? 'Gemmer...' : 'Gem trup'}
        </button>
      </div>
    </div>
  )
}
