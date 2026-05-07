'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatKickoff } from '@/lib/dateUtils'

type MatchOption = {
  id: number
  kickoff: string
  status: string
  home_team: string
  away_team: string
  tournament_name: string | null
  tournament_logo: string | null
  tournament_id: number | null
  is_rivalry: boolean
  rivalry_name: string | null
}

type RoundMatch = {
  id: number
  kickoff: string
  status: string
  home_team: string
  away_team: string
}

type ChampionshipRound = {
  id: number
  name: string
  status: string
  betting_closes_at: string | null
  season: string
  matches: RoundMatch[]
}

type Season = '2025/26' | '2026/27'

type Props = Record<string, never>
function formatWeekRange(bettingCloses: string | null): string {
  if (!bettingCloses) return ''
  // betting_closes_at = mandag 23:59 UTC → start = tirsdag (6 dage før)
  const end = new Date(bettingCloses)
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - 6)
  const fStr = start.toLocaleDateString('da-DK', { timeZone: 'UTC', day: 'numeric', month: 'short' })
  const lStr = end.toLocaleDateString('da-DK', { timeZone: 'UTC', day: 'numeric', month: 'short' })
  return `${fStr} – ${lStr}`
}

export function AdminChampionshipTab() {
  const router = useRouter()
  const authHeader = { }

  // State — sæson
  const [season, setSeason] = useState<Season>('2025/26')

  // State — kamp-browser
  const [availableMatches, setAvailableMatches] = useState<MatchOption[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  // State — championship rounds
  const [champRounds, setChampRounds] = useState<ChampionshipRound[]>([])
  const [loadingChampRounds, setLoadingChampRounds] = useState(true)
  const [activeChampRoundId, setActiveChampRoundId] = useState<number | null>(null)
  const [selectedMatches, setSelectedMatches] = useState<MatchOption[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<Set<number>>(new Set())

  // Hent runder ved sæsonskift
  useEffect(() => {
    fetchChampRounds()
    setActiveChampRoundId(null)
    setSelectedMatches([])
    setAvailableMatches([])
  }, [season])

  // Hent kampe når championship-runde vælges
  useEffect(() => {
    if (activeChampRoundId) {
      const round = champRounds.find((r) => r.id === activeChampRoundId)
      if (round) {
        // Pre-populate selected fra eksisterende kampe
        setSelectedMatches(round.matches.map((m) => ({
          id: m.id, kickoff: m.kickoff, status: m.status,
          home_team: m.home_team, away_team: m.away_team,
          tournament_name: null, tournament_logo: null, tournament_id: null,
          is_rivalry: false, rivalry_name: null,
        })))
        // Hent alle kampe i rundens uge
        fetchMatchesForChampRound(round)
      }
    } else {
      setSelectedMatches([])
      setAvailableMatches([])
    }
    setActiveFilter('all')
  }, [activeChampRoundId])

  async function fetchChampRounds() {
    setLoadingChampRounds(true)
    try {
      const res = await fetch(`/api/admin/championship/rounds?season=${encodeURIComponent(season)}`, { headers: authHeader })
      const data = await res.json()
      if (data.rounds) setChampRounds(data.rounds)
    } catch { /* silent */ } finally {
      setLoadingChampRounds(false)
    }
  }

  async function fetchMatchesForChampRound(round: ChampionshipRound) {
    if (!round.betting_closes_at) return
    setLoadingMatches(true)
    try {
      // Rundens uge: tirsdag 00:01 → mandag 23:59
      const end = new Date(round.betting_closes_at) // mandag 23:59
      const start = new Date(end)
      start.setUTCDate(end.getUTCDate() - 6)
      start.setUTCHours(0, 1, 0, 0) // tirsdag 00:01
      const from = start.toISOString()
      const to = end.toISOString()
      const res = await fetch(`/api/admin/championship/matches?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: authHeader })
      const data = await res.json()
      if (data.matches) setAvailableMatches(data.matches)
    } catch { /* silent */ } finally {
      setLoadingMatches(false)
    }
  }

  async function handleGenerate() {
    if (!confirm(`Generer alle mesterskabsrunder for ${season}?`)) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/championship/generate', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ season }),
      })
      const data = await res.json()
      if (data.ok) {
        fetchChampRounds()
        router.refresh()
      } else {
        alert(data.error ?? 'Fejl ved generering')
      }
    } catch { alert('Netværksfejl') } finally {
      setGenerating(false)
    }
  }

  function addMatch(match: MatchOption) {
    if (selectedMatches.length >= 9) return
    if (selectedMatches.some((m) => m.id === match.id)) return
    setSelectedMatches((prev) => [...prev, match])
  }

  function removeMatch(matchId: number) {
    setSelectedMatches((prev) => prev.filter((m) => m.id !== matchId))
  }

  async function saveMatchesToRound() {
    if (!activeChampRoundId || selectedMatches.length === 0) return
    setSaving(true)
    try {
      const champRound = champRounds.find((r) => r.id === activeChampRoundId)
      // Slet + genopret
      await fetch(`/api/admin/championship/rounds/${activeChampRoundId}`, { method: 'DELETE', headers: authHeader })
      const createRes = await fetch('/api/admin/championship/rounds', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: champRound?.name ?? `Runde`,
          betting_closes_at: champRound?.betting_closes_at ?? null,
          match_ids: selectedMatches.map((m) => m.id),
        }),
      })
      const createData = await createRes.json()
      if (createData.ok) {
        fetchChampRounds()
        router.refresh()
      } else {
        alert(createData.error ?? 'Fejl ved oprettelse')
      }
    } catch { alert('Netværksfejl') } finally {
      setSaving(false)
    }
  }

  async function deleteRound(roundId: number) {
    setDeleteLoading((s) => new Set(s).add(roundId))
    try {
      const res = await fetch(`/api/admin/championship/rounds/${roundId}`, { method: 'DELETE', headers: authHeader })
      const data = await res.json()
      if (data.ok) {
        setChampRounds((prev) => prev.filter((r) => r.id !== roundId))
        if (activeChampRoundId === roundId) setActiveChampRoundId(null)
        setDeleteConfirm(null)
      } else { alert(data.error ?? 'Fejl') }
    } catch { alert('Netværksfejl') } finally {
      setDeleteLoading((s) => { const n = new Set(s); n.delete(roundId); return n })
    }
  }

  const selectedIds = new Set(selectedMatches.map((m) => m.id))

  // Pill filters — byg fra tilgængelige kampe
  const tournamentPills = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    let rivalryCount = 0
    for (const m of availableMatches) {
      if (m.is_rivalry) rivalryCount++
      const tName = m.tournament_name ?? 'Andet'
      const existing = map.get(tName)
      if (existing) existing.count++
      else map.set(tName, { name: tName, count: 1 })
    }
    const pills: Array<{ key: string; label: string; count: number }> = [
      { key: 'all', label: 'Alle', count: availableMatches.length },
    ]
    if (rivalryCount > 0) pills.push({ key: 'rivalry', label: '🔥 Rivalopgør', count: rivalryCount })
    for (const [key, val] of map) {
      pills.push({ key, label: val.name, count: val.count })
    }
    return pills
  }, [availableMatches])

  // Filtrer kampe
  const filteredMatches = useMemo(() => {
    if (activeFilter === 'all') return availableMatches
    if (activeFilter === 'rivalry') return availableMatches.filter((m) => m.is_rivalry)
    return availableMatches.filter((m) => (m.tournament_name ?? 'Andet') === activeFilter)
  }, [availableMatches, activeFilter])

  // Find aktiv runde
  const now = new Date().toISOString()
  const currentChampRound = useMemo(() =>
    champRounds.find((r) => r.status === 'open') ??
    champRounds.find((r) => r.status === 'upcoming' && r.betting_closes_at && r.betting_closes_at > now) ??
    null,
    [champRounds, now]
  )

  return (
    <div>
      <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Administration</p>
      <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-6">Mesterskabet</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* ── Venstre: Kamp-browser ──────────────────────────── */}
        <div>
          <h3 className="font-condensed font-bold text-ink text-sm uppercase tracking-wide mb-3">
            {activeChampRoundId ? `Kampe · ${champRounds.find((r) => r.id === activeChampRoundId)?.name ?? ''}` : 'Kampe'}
          </h3>

          {!activeChampRoundId ? (
            <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Vælg en runde i højre panel for at se kampe</p>
            </div>
          ) : (
            <>
              {/* Pill filters */}
              {tournamentPills.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tournamentPills.map((pill) => (
                    <button
                      key={pill.key}
                      onClick={() => setActiveFilter(pill.key)}
                      className={`font-condensed text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                        activeFilter === pill.key
                          ? 'bg-forest text-cream'
                          : 'bg-cream-dark text-warm-gray hover:bg-warm-border'
                      }`}
                    >
                      {pill.label} ({pill.count})
                    </button>
                  ))}
                </div>
              )}

              {/* Valgte kampe boks */}
              {selectedMatches.length > 0 && (
                <div className="mb-4 border border-forest/30 rounded-sm bg-forest/5 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-condensed text-xs font-bold text-forest uppercase tracking-wide">
                      Valgte ({selectedMatches.length}/9)
                    </span>
                    <button
                      onClick={saveMatchesToRound}
                      disabled={saving}
                      className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 bg-forest text-cream rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity cursor-pointer"
                    >
                      {saving ? 'Gemmer...' : 'Gem kampe'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {selectedMatches.map((match, i) => (
                      <div key={match.id} className="flex items-center justify-between gap-2 px-2 py-1 bg-white rounded-sm">
                        <span className="font-body text-xs text-ink truncate">
                          <span className="font-condensed font-bold">{i + 1}.</span> {match.home_team} – {match.away_team}
                          {match.is_rivalry && <span className="ml-1">🔥</span>}
                        </span>
                        <button onClick={() => removeMatch(match.id)} className="text-[10px] text-vintage-red cursor-pointer shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kampliste */}
              {loadingMatches ? (
                <div className="text-center py-8">
                  <span className="font-condensed text-sm text-warm-gray uppercase tracking-wide">Henter kampe...</span>
                </div>
              ) : filteredMatches.length === 0 ? (
                <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
                  <p className="font-body text-warm-gray text-sm">Ingen kampe fundet</p>
                </div>
              ) : (
                <div className="border border-warm-border rounded-sm overflow-hidden">
                  <div className="divide-y divide-warm-border">
                    {filteredMatches.map((match) => {
                      const isSelected = selectedIds.has(match.id)
                      return (
                        <div
                          key={match.id}
                          className={`flex items-center gap-3 px-4 py-3 ${isSelected ? 'bg-forest/5' : 'bg-cream hover:bg-cream-dark/40'} transition-colors`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-body text-sm font-medium text-ink truncate">
                                {match.home_team} – {match.away_team}
                              </span>
                              {match.is_rivalry && (
                                <span className="font-condensed text-[9px] font-bold text-gold uppercase tracking-wide shrink-0">🔥</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-body text-xs text-warm-gray">{formatKickoff(match.kickoff)}</span>
                              {match.tournament_name && (
                                <span className="font-condensed text-[9px] font-bold text-warm-gray uppercase tracking-wide">{match.tournament_name}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => isSelected ? removeMatch(match.id) : addMatch(match)}
                            disabled={!isSelected && selectedMatches.length >= 9}
                            className={`font-condensed text-xs uppercase tracking-wide px-3 py-1.5 rounded-sm transition-colors cursor-pointer shrink-0 ${
                              isSelected
                                ? 'bg-vintage-red text-cream hover:opacity-85'
                                : 'border border-forest/40 text-forest hover:bg-forest hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed'
                            }`}
                          >
                            {isSelected ? 'Fjern' : 'Tilføj'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Højre: Sæson + runde-liste ────────────────────── */}
        <div>
          {/* Sæson-vælger */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-condensed font-bold text-ink text-sm uppercase tracking-wide">Runder</h3>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as Season)}
              className="font-condensed text-xs font-bold text-ink border border-warm-border bg-cream px-2 py-1 rounded-sm cursor-pointer"
            >
              <option value="2025/26">2025/26</option>
              <option value="2026/27">2026/27</option>
            </select>
          </div>

          {/* Generer knap */}
          {!loadingChampRounds && champRounds.length === 0 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full font-condensed font-bold text-sm uppercase tracking-wide bg-forest text-cream px-6 py-3 rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity cursor-pointer mb-4"
            >
              {generating ? 'Genererer...' : `Generer runder for ${season}`}
            </button>
          )}

          {/* Runde-liste */}
          {loadingChampRounds ? (
            <div className="text-center py-8">
              <span className="font-condensed text-sm text-warm-gray uppercase tracking-wide">Henter...</span>
            </div>
          ) : champRounds.length === 0 ? (
            <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Ingen runder for {season}</p>
            </div>
          ) : (
            <div className="border border-warm-border rounded-sm overflow-hidden max-h-[calc(100vh-220px)] overflow-y-auto">
              <div className="divide-y divide-warm-border">
                {champRounds.map((round) => {
                  const isPast = round.betting_closes_at != null && round.betting_closes_at < now
                  const isActive = !isPast && activeChampRoundId === round.id
                  const isCurrent = !isPast && currentChampRound?.id === round.id
                  const isConfirming = deleteConfirm === round.id
                  const isDeleting = deleteLoading.has(round.id)
                  const weekRange = formatWeekRange(round.betting_closes_at)

                  return (
                    <div
                      key={round.id}
                      className={`px-3 py-2.5 transition-colors ${
                        isPast ? 'opacity-60' :
                        isActive ? 'bg-forest/10 border-l-2 border-l-forest cursor-pointer' :
                        isCurrent ? 'bg-gold/5 cursor-pointer' :
                        'bg-cream hover:bg-cream-dark/40 cursor-pointer'
                      }`}
                      onClick={() => !isPast && setActiveChampRoundId(isActive ? null : round.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-condensed text-xs font-bold uppercase ${
                              isPast ? 'text-[var(--color-muted)] line-through' :
                              isActive ? 'text-forest' : 'text-ink'
                            }`}>
                              {round.name}
                            </span>
                            {isCurrent && (
                              <span className="font-condensed text-[8px] font-bold text-gold uppercase tracking-wide px-1 py-0.5 bg-gold/15 rounded-sm">
                                Aktiv
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`font-body text-[10px] ${isPast ? 'text-[var(--color-muted)]' : 'text-warm-gray'}`}>{weekRange}</span>
                            <span className={`font-condensed text-[10px] font-bold ${
                              isPast ? 'text-[var(--color-muted)]' :
                              round.matches.length > 0 ? 'text-forest' : 'text-warm-gray'
                            }`}>
                              {round.matches.length}/9
                            </span>
                          </div>
                        </div>
                        {isActive && !isPast && (
                          <div onClick={(e) => e.stopPropagation()}>
                            {isConfirming ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => deleteRound(round.id)}
                                  disabled={isDeleting}
                                  className="font-condensed text-[10px] uppercase px-2 py-1 bg-vintage-red text-cream rounded-sm disabled:opacity-40 cursor-pointer"
                                >
                                  {isDeleting ? '...' : 'Ja'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="font-condensed text-[10px] uppercase px-2 py-1 border border-warm-border text-warm-gray rounded-sm cursor-pointer"
                                >
                                  Nej
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(round.id)}
                                className="font-condensed text-[10px] uppercase px-2 py-1 text-vintage-red hover:text-vintage-red/70 cursor-pointer"
                              >
                                Slet
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
