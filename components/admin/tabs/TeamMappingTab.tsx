'use client'

import { useState, useEffect, useCallback } from 'react'

type TeamRow = {
  bb_team_id: number
  bb_team_name: string
  bold_team_id: number | null
  bold_tournament_id: number | null
}

type LeagueGroup = {
  league_id: number
  league_name: string
  country: string
  default_tournament_id: number
  teams: TeamRow[]
}

type LeagueConfig = {
  id: number
  name: string
  bold_tournament_id: number
  bold_phase_id: number | null
}

type TeamXrefData = {
  leagues: LeagueConfig[]
  groups: LeagueGroup[]
}

const COUNTRY_ORDER = [
  'England', 'Germany', 'Spain', 'Italy', 'France',
  'Belgium', 'Europe', 'Denmark', 'Netherlands', 'Turkey', 'World',
]

const COUNTRY_FLAGS: Record<string, string> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Germany: '🇩🇪',
  Spain: '🇪🇸',
  France: '🇫🇷',
  Italy: '🇮🇹',
  Netherlands: '🇳🇱',
  Turkey: '🇹🇷',
  Denmark: '🇩🇰',
  Europe: '🇪🇺',
  Belgium: '🇧🇪',
  World: '🌍',
}

type Props = {
  adminSecret: string
}

export function TeamMappingTab({ adminSecret }: Props) {
  const [data, setData] = useState<TeamXrefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'unmapped' | 'all'>('unmapped')
  const [localValues, setLocalValues] = useState<
    Record<number, { bold_team_id: string; bold_tournament_id: string }>
  >({})
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const [leaguePhaseValues, setLeaguePhaseValues] = useState<Record<number, string>>({})
  const [savedLeagueIds, setSavedLeagueIds] = useState<Set<number>>(new Set())
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null)
  const [editingLeagueId, setEditingLeagueId] = useState<number | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null)

  const authHeader = { Authorization: `Bearer ${adminSecret}` }

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/admin/team-xref', { headers: authHeader })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setData(json)
      setLocalValues(() => {
        const next: Record<number, { bold_team_id: string; bold_tournament_id: string }> = {}
        for (const lg of json.groups ?? []) {
          for (const t of lg.teams) {
            next[t.bb_team_id] = {
              bold_team_id: t.bold_team_id != null ? String(t.bold_team_id) : '',
              bold_tournament_id:
                t.bold_tournament_id != null
                  ? String(t.bold_tournament_id)
                  : String(lg.default_tournament_id || ''),
            }
          }
        }
        return next
      })
      setLeaguePhaseValues(() => {
        const next: Record<number, string> = {}
        for (const l of json.leagues ?? []) {
          next[Number(l.id)] = l.bold_phase_id != null ? String(l.bold_phase_id) : ''
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente data')
    } finally {
      setLoading(false)
    }
  }, [adminSecret])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Default til første land og første liga ved load
  useEffect(() => {
    if (!data?.groups?.length) return
    const countrySet = new Set(data.groups.map((g) => g.country))
    const countries = COUNTRY_ORDER.filter((c) => countrySet.has(c))
    const rest = [...countrySet].filter((c) => !COUNTRY_ORDER.includes(c)).sort()
    const orderedCountries = [...countries, ...rest]
    const firstCountry = orderedCountries[0] ?? null
    const leaguesInCountry = data.groups
      .filter((g) => g.country === firstCountry)
      .sort((a, b) => a.league_name.localeCompare(b.league_name))
    const firstLeague = leaguesInCountry[0] ?? null
    setSelectedCountry((prev) => (prev === null ? firstCountry : prev))
    setSelectedLeagueId((prev) => {
      if (prev === null) return firstLeague?.league_id ?? null
      const stillValid = leaguesInCountry.some((g) => g.league_id === prev)
      return stillValid ? prev : firstLeague?.league_id ?? null
    })
  }, [data])

  const handleSave = async (bbTeamId: number, leagueDefaultTournamentId: number, onSaved?: () => void) => {
    const vals = localValues[bbTeamId]
    if (!vals) return
    const boldTeamId = parseInt(vals.bold_team_id, 10)
    const boldTournamentId = parseInt(vals.bold_tournament_id, 10)
    if (isNaN(boldTeamId) || isNaN(boldTournamentId)) return

    try {
      const res = await fetch(`/api/admin/team-xref/${bbTeamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ bold_team_id: boldTeamId, bold_tournament_id: boldTournamentId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          groups: prev.groups.map((lg) => ({
            ...lg,
            teams: lg.teams.map((t) =>
              t.bb_team_id === bbTeamId
                ? { ...t, bold_team_id: boldTeamId, bold_tournament_id: boldTournamentId }
                : t
            ),
          })),
        }
      })
      setSavedIds((s) => new Set(s).add(bbTeamId))
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo(0, scrollY))
        })
      }
      setTimeout(() => {
        setSavedIds((s) => {
          const next = new Set(s)
          next.delete(bbTeamId)
          return next
        })
        onSaved?.()
      }, 2000)
    } catch {
      // Silent fail for now
    }
  }

  const handleSaveLeaguePhase = async (leagueId: number, onSaved?: () => void) => {
    const id = Number(leagueId)
    const val = leaguePhaseValues[id] ?? leaguePhaseValues[leagueId] ?? ''
    const phaseId = parseInt(val, 10)
    if (isNaN(phaseId)) return

    try {
      const res = await fetch(`/api/admin/leagues/${id}/bold-phase`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ bold_phase_id: phaseId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0
      setSavedLeagueIds((prev) => new Set([...prev, id]))
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          leagues: prev.leagues.map((l) =>
            Number(l.id) === id ? { ...l, bold_phase_id: phaseId } : l
          ),
        }
      })
      // Gendan scroll efter React re-render så brugeren ser "Gemt ✓"
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo(0, scrollY))
        })
      }
      setTimeout(() => {
        setSavedLeagueIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        onSaved?.()
      }, 2000)
    } catch {
      // Silent fail
    }
  }

  const updateLocal = (bbTeamId: number, field: 'bold_team_id' | 'bold_tournament_id', value: string) => {
    setLocalValues((prev) => ({
      ...prev,
      [bbTeamId]: {
        ...(prev[bbTeamId] ?? { bold_team_id: '', bold_tournament_id: '' }),
        [field]: value,
      },
    }))
  }

  if (loading && !data) {
    return (
      <div className="py-8 text-center text-[#7a7060]">
        Henter mappings...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="py-8 text-center text-red-600">
        {error}
      </div>
    )
  }

  const d = data!
  const groups = d.groups ?? []
  const countrySet = new Set(groups.map((g) => g.country))
  const countries = [...COUNTRY_ORDER.filter((c) => countrySet.has(c)), ...[...countrySet].filter((c) => !COUNTRY_ORDER.includes(c)).sort()]
  const leaguesInSelectedCountry = groups
    .filter((g) => g.country === selectedCountry)
    .sort((a, b) => a.league_name.localeCompare(b.league_name))
  const selectedLeague = selectedLeagueId != null
    ? leaguesInSelectedCountry.find((g) => g.league_id === selectedLeagueId)
    : leaguesInSelectedCountry[0] ?? null

  const teamsInLeague = selectedLeague?.teams ?? []
  const filteredTeams =
    filter === 'unmapped'
      ? teamsInLeague.filter((t) => t.bold_team_id == null)
      : teamsInLeague

  const allTeams = groups.flatMap((lg) => lg.teams.map((t) => ({ ...t, defaultTournamentId: lg.default_tournament_id })))
  const mappedCount = allTeams.filter((t) => t.bold_team_id != null).length
  const totalCount = allTeams.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1a3329]">Mappings</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-[#2C4A3E]/10 text-[#2C4A3E]">
            {mappedCount} / {totalCount} mappede
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unmapped')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              filter === 'unmapped'
                ? 'bg-[#2C4A3E] text-white'
                : 'bg-white border border-black/10 text-[#7a7060] hover:bg-cream/50'
            }`}
          >
            Ikke mappede
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              filter === 'all'
                ? 'bg-[#2C4A3E] text-white'
                : 'bg-white border border-black/10 text-[#7a7060] hover:bg-cream/50'
            }`}
          >
            Alle
          </button>
        </div>
      </div>

      {/* Liga-konfiguration */}
      {(() => {
        const configLeagues = d.leagues ?? []
        if (configLeagues.length === 0) return null
        return (
          <div className="border border-black/10 rounded-lg overflow-hidden bg-white">
            <h3 className="bg-[#2C4A3E] text-white px-4 py-2.5 text-sm font-semibold">
              Liga-konfiguration
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream-dark border-b border-black/10">
                    <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Liga</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Tournament ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Phase ID (sæson)</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#1a3329]"></th>
                  </tr>
                </thead>
                <tbody>
                  {configLeagues.map((l) => {
                    const leagueId = Number(l.id)
                    const phaseVal = leaguePhaseValues[leagueId] ?? (l.bold_phase_id != null ? String(l.bold_phase_id) : '')
                    const justSaved = savedLeagueIds.has(leagueId)
                    const isEditing = editingLeagueId === leagueId
                    const hasValue = l.bold_phase_id != null
                    const showReadOnly = hasValue && !isEditing
                    return (
                      <tr key={l.id} className="border-b border-black/5 hover:bg-cream/30">
                        <td className="px-4 py-3 text-[#1a3329]">{l.name}</td>
                        <td className="px-4 py-3 font-mono text-[#7a7060]">{l.bold_tournament_id}</td>
                        <td className="px-4 py-3">
                          {showReadOnly ? (
                            <span className="font-mono text-[#1a3329]">{l.bold_phase_id}</span>
                          ) : (
                            <input
                              type="number"
                              value={phaseVal}
                              onChange={(e) => setLeaguePhaseValues((p) => ({ ...p, [leagueId]: e.target.value }))}
                              className="w-24 px-2 py-1.5 border border-black/15 rounded text-sm font-mono"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 flex items-center gap-2">
                          {showReadOnly ? (
                            <button
                              type="button"
                              onClick={() => setEditingLeagueId(leagueId)}
                              className="px-2 py-1 text-xs font-medium text-[#7a7060] hover:text-[#1a3329] hover:bg-cream/50 rounded transition-colors"
                            >
                              Rediger
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleSaveLeaguePhase(leagueId, () => setEditingLeagueId(null))
                                }}
                                disabled={!phaseVal || isNaN(parseInt(phaseVal, 10))}
                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                  justSaved
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-[#2C4A3E] text-white hover:bg-[#1a3329] disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                              >
                                {justSaved ? 'Gemt ✓' : 'Gem'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLeagueId(null)
                                  setLeaguePhaseValues((p) => ({
                                    ...p,
                                    [leagueId]: l.bold_phase_id != null ? String(l.bold_phase_id) : '',
                                  }))
                                }}
                                className="px-2 py-1 text-xs font-medium text-[#7a7060] hover:text-[#1a3329] hover:bg-cream/50 rounded transition-colors"
                              >
                                Annuller
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Lande-tabs */}
      <div className="flex flex-wrap gap-1 border-b border-black/10 pb-2">
        {countries.map((c) => (
          <button
            key={c}
            onClick={() => {
              setSelectedCountry(c)
              const firstInCountry = groups
                .filter((g) => g.country === c)
                .sort((a, b) => a.league_name.localeCompare(b.league_name))[0]
              setSelectedLeagueId(firstInCountry?.league_id ?? null)
            }}
            className={`px-3 py-2 text-sm font-medium rounded-t-sm transition-colors ${
              selectedCountry === c
                ? 'bg-[#2C4A3E] text-white'
                : 'bg-white border border-black/10 text-[#7a7060] hover:bg-cream/50'
            }`}
          >
            {COUNTRY_FLAGS[c] ?? '🏳️'} {c}
          </button>
        ))}
      </div>

      {/* Liga-sub-tabs (kun for valgt land) */}
      {leaguesInSelectedCountry.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {leaguesInSelectedCountry.map((lg) => (
            <button
              key={lg.league_id}
              onClick={() => setSelectedLeagueId(lg.league_id)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                selectedLeagueId === lg.league_id
                  ? 'bg-[#2C4A3E] text-white'
                  : 'bg-white border border-black/10 text-[#7a7060] hover:bg-cream/50'
              }`}
            >
              {lg.league_name}
            </button>
          ))}
        </div>
      )}

      {/* Hold-tabel for valgt liga */}
      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center text-[#7a7060] text-sm">
          {selectedLeague
            ? filter === 'unmapped'
              ? 'Alle hold er mappede'
              : 'Ingen hold'
            : 'Vælg et land og en liga'}
        </div>
      ) : selectedLeague && (
        <div className="border border-black/10 rounded-lg overflow-hidden bg-white">
          <h3 className="bg-[#2C4A3E] text-white px-4 py-2.5 text-sm font-semibold">
            {selectedLeague.league_name}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-dark border-b border-black/10">
                  <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">BB Navn</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Bold Team ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Bold Tournament ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1a3329]"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((t) => {
                  const vals = localValues[t.bb_team_id] ?? {
                    bold_team_id: t.bold_team_id != null ? String(t.bold_team_id) : '',
                    bold_tournament_id:
                      t.bold_tournament_id != null
                        ? String(t.bold_tournament_id)
                        : String(selectedLeague.default_tournament_id),
                  }
                  const isMapped = t.bold_team_id != null
                  const isEditing = editingTeamId === t.bb_team_id
                  const showReadOnly = isMapped && !isEditing
                  const justSaved = savedIds.has(t.bb_team_id)
                  return (
                    <tr key={t.bb_team_id} className="border-b border-black/5 hover:bg-cream/30">
                      <td className="px-4 py-3 text-[#1a3329]">{t.bb_team_name}</td>
                      <td className="px-4 py-3">
                        {showReadOnly ? (
                          <span className="font-mono text-[#1a3329]">{t.bold_team_id} ✓</span>
                        ) : (
                          <input
                            type="number"
                            value={vals.bold_team_id}
                            onChange={(e) => updateLocal(t.bb_team_id, 'bold_team_id', e.target.value)}
                            className="w-24 px-2 py-1.5 border border-black/15 rounded text-sm font-mono"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {showReadOnly ? (
                          <span className="font-mono text-[#1a3329]">{t.bold_tournament_id} ✓</span>
                        ) : (
                          <input
                            type="number"
                            value={vals.bold_tournament_id}
                            onChange={(e) => updateLocal(t.bb_team_id, 'bold_tournament_id', e.target.value)}
                            className="w-24 px-2 py-1.5 border border-black/15 rounded text-sm font-mono"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isMapped ? (
                          <span className="text-green-600" title="Mappet">✓</span>
                        ) : (
                          <span className="text-red-500" title="Ikke mappet">○</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {showReadOnly ? (
                          <button
                            type="button"
                            onClick={() => setEditingTeamId(t.bb_team_id)}
                            className="px-2 py-1 text-xs font-medium text-[#7a7060] hover:text-[#1a3329] hover:bg-cream/50 rounded transition-colors"
                          >
                            Rediger
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                handleSave(t.bb_team_id, selectedLeague.default_tournament_id, () => setEditingTeamId(null))
                              }}
                              disabled={
                                !vals.bold_team_id ||
                                !vals.bold_tournament_id ||
                                isNaN(parseInt(vals.bold_team_id, 10)) ||
                                isNaN(parseInt(vals.bold_tournament_id, 10))
                              }
                              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                justSaved
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-[#2C4A3E] text-white hover:bg-[#1a3329] disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              {justSaved ? 'Gemt ✓' : 'Gem'}
                            </button>
                            {isMapped && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTeamId(null)
                                  setLocalValues((p) => ({
                                    ...p,
                                    [t.bb_team_id]: {
                                      bold_team_id: String(t.bold_team_id ?? ''),
                                      bold_tournament_id: String(t.bold_tournament_id ?? selectedLeague.default_tournament_id),
                                    },
                                  }))
                                }}
                                className="px-2 py-1 text-xs font-medium text-[#7a7060] hover:text-[#1a3329] hover:bg-cream/50 rounded transition-colors"
                              >
                                Annuller
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
