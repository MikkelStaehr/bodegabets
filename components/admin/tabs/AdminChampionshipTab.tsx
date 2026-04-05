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

type RoundOverview = {
  id: number
  name: string
  season_id: number
  status: string
  tournament_name: string | null
  tournament_id: number | null
  first_kickoff: string | null
  last_kickoff: string | null
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
  matches: RoundMatch[]
}

type Props = { adminSecret: string }

function formatWeekRange(bettingCloses: string | null): string {
  if (!bettingCloses) return ''
  // Runden slutter mandag 23:59 → startede tirsdag (6 dage før)
  const end = new Date(bettingCloses)
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - 6)
  const fStr = start.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  const lStr = end.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  return `${fStr} – ${lStr}`
}

export function AdminChampionshipTab({ adminSecret }: Props) {
  const router = useRouter()
  const authHeader = { Authorization: `Bearer ${adminSecret}` }

  // State — kamp-browser
  const [roundOptions, setRoundOptions] = useState<RoundOverview[]>([])
  const [selectedLeagueRoundId, setSelectedLeagueRoundId] = useState<string>('')
  const [availableMatches, setAvailableMatches] = useState<MatchOption[]>([])
  const [loadingRoundOptions, setLoadingRoundOptions] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)

  // State — championship rounds
  const [champRounds, setChampRounds] = useState<ChampionshipRound[]>([])
  const [loadingChampRounds, setLoadingChampRounds] = useState(true)
  const [activeChampRoundId, setActiveChampRoundId] = useState<number | null>(null)
  const [selectedMatches, setSelectedMatches] = useState<MatchOption[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<Set<number>>(new Set())

  // Hent data on mount
  useEffect(() => {
    fetchRoundOptions()
    fetchChampRounds()
  }, [])

  // Hent kampe når liga-runde vælges
  useEffect(() => {
    if (selectedLeagueRoundId) fetchMatchesForRound(selectedLeagueRoundId)
    else setAvailableMatches([])
  }, [selectedLeagueRoundId])

  // Når championship-runde vælges, load dens eksisterende kampe
  useEffect(() => {
    if (activeChampRoundId) {
      const round = champRounds.find((r) => r.id === activeChampRoundId)
      if (round) {
        // Pre-populate selectedMatches from existing round matches
        setSelectedMatches(round.matches.map((m) => ({
          id: m.id,
          kickoff: m.kickoff,
          status: m.status,
          home_team: m.home_team,
          away_team: m.away_team,
          tournament_name: null,
          tournament_logo: null,
          tournament_id: null,
          is_rivalry: false,
          rivalry_name: null,
        })))
      }
    } else {
      setSelectedMatches([])
    }
  }, [activeChampRoundId])

  async function fetchRoundOptions() {
    setLoadingRoundOptions(true)
    try {
      const res = await fetch('/api/admin/championship/rounds-overview', { headers: authHeader })
      const data = await res.json()
      if (data.rounds) setRoundOptions(data.rounds)
    } catch { /* silent */ } finally {
      setLoadingRoundOptions(false)
    }
  }

  async function fetchMatchesForRound(roundId: string) {
    const round = roundOptions.find((r) => String(r.id) === roundId)
    if (!round?.first_kickoff || !round?.last_kickoff) {
      setAvailableMatches([])
      return
    }
    setLoadingMatches(true)
    try {
      const from = new Date(new Date(round.first_kickoff).getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = new Date(new Date(round.last_kickoff).getTime() + 24 * 60 * 60 * 1000).toISOString()
      const params = new URLSearchParams({ from, to })
      if (round.tournament_id) params.set('tournament_id', String(round.tournament_id))
      const res = await fetch(`/api/admin/championship/matches?${params}`, { headers: authHeader })
      const data = await res.json()
      if (data.matches) setAvailableMatches(data.matches)
    } catch { /* silent */ } finally {
      setLoadingMatches(false)
    }
  }

  async function fetchChampRounds() {
    setLoadingChampRounds(true)
    try {
      const res = await fetch('/api/admin/championship/rounds', { headers: authHeader })
      const data = await res.json()
      if (data.rounds) setChampRounds(data.rounds)
    } catch { /* silent */ } finally {
      setLoadingChampRounds(false)
    }
  }

  async function handleGenerate() {
    if (!confirm('Generer alle mesterskabsrunder for sæson 2025/2026?\n\nDette opretter ~43 runder.')) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/championship/generate', {
        method: 'POST',
        headers: authHeader,
      })
      const data = await res.json()
      if (data.ok) {
        fetchChampRounds()
        router.refresh()
      } else {
        alert(data.error ?? 'Fejl ved generering')
      }
    } catch {
      alert('Netværksfejl')
    } finally {
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
      // Slet eksisterende tilknytninger og genopret
      const res = await fetch(`/api/admin/championship/rounds/${activeChampRoundId}`, {
        method: 'DELETE',
        headers: authHeader,
      })
      const delData = await res.json()
      if (!delData.ok) {
        alert(delData.error ?? 'Fejl ved opdatering')
        setSaving(false)
        return
      }

      // Find aktiv championship round data
      const champRound = champRounds.find((r) => r.id === activeChampRoundId)

      // Genopret runden med nye kampe
      const createRes = await fetch('/api/admin/championship/rounds', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: champRound?.name ?? `Runde ${activeChampRoundId}`,
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
    } catch {
      alert('Netværksfejl')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRound(roundId: number) {
    setDeleteLoading((s) => new Set(s).add(roundId))
    try {
      const res = await fetch(`/api/admin/championship/rounds/${roundId}`, {
        method: 'DELETE',
        headers: authHeader,
      })
      const data = await res.json()
      if (data.ok) {
        setChampRounds((prev) => prev.filter((r) => r.id !== roundId))
        if (activeChampRoundId === roundId) setActiveChampRoundId(null)
        setDeleteConfirm(null)
        router.refresh()
      } else {
        alert(data.error ?? 'Fejl ved sletning')
      }
    } catch {
      alert('Netværksfejl')
    } finally {
      setDeleteLoading((s) => { const n = new Set(s); n.delete(roundId); return n })
    }
  }

  const selectedIds = new Set(selectedMatches.map((m) => m.id))

  // Find "aktiv" runde baseret på nu-tidspunkt
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
          <h3 className="font-condensed font-bold text-ink text-sm uppercase tracking-wide mb-3">Kampe</h3>

          {/* Liga-runde dropdown */}
          <select
            value={selectedLeagueRoundId}
            onChange={(e) => setSelectedLeagueRoundId(e.target.value)}
            disabled={loadingRoundOptions}
            className="w-full font-body text-sm text-ink border border-warm-border bg-cream px-3 py-2 rounded-sm mb-4 cursor-pointer"
          >
            <option value="">Vælg en liga-runde...</option>
            {roundOptions.map((r) => {
              const dateRange = r.first_kickoff && r.last_kickoff
                ? (() => {
                    const f = new Date(r.first_kickoff).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                    const l = new Date(r.last_kickoff).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                    return f === l ? f : `${f} – ${l}`
                  })()
                : ''
              return (
                <option key={r.id} value={String(r.id)}>
                  {r.tournament_name ?? 'Ukendt'} — {r.name} ({dateRange})
                </option>
              )
            })}
          </select>

          {/* Valgte kampe for aktiv championship-runde */}
          {activeChampRoundId && selectedMatches.length > 0 && (
            <div className="mb-4 border border-forest/30 rounded-sm bg-forest/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-condensed text-xs font-bold text-forest uppercase tracking-wide">
                  Valgte kampe ({selectedMatches.length}/9)
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
          {!selectedLeagueRoundId ? (
            <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Vælg en liga-runde ovenfor for at se kampe</p>
            </div>
          ) : loadingMatches ? (
            <div className="text-center py-8">
              <span className="font-condensed text-sm text-warm-gray uppercase tracking-wide">Henter kampe...</span>
            </div>
          ) : availableMatches.length === 0 ? (
            <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Ingen kampe fundet</p>
            </div>
          ) : (
            <div className="border border-warm-border rounded-sm overflow-hidden">
              <div className="divide-y divide-warm-border">
                {availableMatches.map((match) => {
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
                        disabled={!activeChampRoundId || (!isSelected && selectedMatches.length >= 9)}
                        className={`font-condensed text-xs uppercase tracking-wide px-3 py-1.5 rounded-sm transition-colors cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-vintage-red text-cream hover:opacity-85'
                            : !activeChampRoundId
                            ? 'border border-warm-border text-warm-gray cursor-not-allowed opacity-50'
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
        </div>

        {/* ── Højre: Championship runder ─────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-condensed font-bold text-ink text-sm uppercase tracking-wide">Runder</h3>
            {champRounds.length === 0 && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 bg-forest text-cream rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity cursor-pointer"
              >
                {generating ? 'Genererer...' : 'Generer runder'}
              </button>
            )}
          </div>

          {loadingChampRounds ? (
            <div className="text-center py-8">
              <span className="font-condensed text-sm text-warm-gray uppercase tracking-wide">Henter...</span>
            </div>
          ) : champRounds.length === 0 ? (
            <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Ingen runder. Klik "Generer runder" for at oprette sæsonen.</p>
            </div>
          ) : (
            <div className="border border-warm-border rounded-sm overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="divide-y divide-warm-border">
                {champRounds.map((round) => {
                  const isActive = activeChampRoundId === round.id
                  const isCurrent = currentChampRound?.id === round.id
                  const isConfirming = deleteConfirm === round.id
                  const isDeleting = deleteLoading.has(round.id)
                  const weekRange = formatWeekRange(round.betting_closes_at)

                  return (
                    <div
                      key={round.id}
                      className={`px-3 py-2.5 cursor-pointer transition-colors ${
                        isActive ? 'bg-forest/10 border-l-2 border-l-forest' : isCurrent ? 'bg-gold/5' : 'bg-cream hover:bg-cream-dark/40'
                      }`}
                      onClick={() => setActiveChampRoundId(isActive ? null : round.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-condensed text-xs font-bold uppercase ${isActive ? 'text-forest' : 'text-ink'}`}>
                              {round.name}
                            </span>
                            {isCurrent && (
                              <span className="font-condensed text-[8px] font-bold text-gold uppercase tracking-wide px-1 py-0.5 bg-gold/15 rounded-sm">
                                Aktiv
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-body text-[10px] text-warm-gray">{weekRange}</span>
                            <span className={`font-condensed text-[10px] font-bold ${round.matches.length > 0 ? 'text-forest' : 'text-warm-gray'}`}>
                              {round.matches.length}/9
                            </span>
                          </div>
                        </div>
                        {isActive && (
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
