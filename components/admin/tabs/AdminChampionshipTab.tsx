'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatKickoff, formatDateTime } from '@/lib/dateUtils'

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

function formatDateRange(first: string | null, last: string | null): string {
  if (!first) return ''
  const f = new Date(first)
  const l = last ? new Date(last) : f
  const fStr = f.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  const lStr = l.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  return fStr === lStr ? fStr : `${fStr} – ${lStr}`
}

export function AdminChampionshipTab({ adminSecret }: Props) {
  const router = useRouter()
  const authHeader = { Authorization: `Bearer ${adminSecret}` }

  // State — kamp-browser
  const [roundOptions, setRoundOptions] = useState<RoundOverview[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string>('')
  const [availableMatches, setAvailableMatches] = useState<MatchOption[]>([])
  const [loadingRoundOptions, setLoadingRoundOptions] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)

  // State — runde builder
  const [roundName, setRoundName] = useState('')
  const [selectedMatches, setSelectedMatches] = useState<MatchOption[]>([])
  const [bettingCloses, setBettingCloses] = useState('')
  const [saving, setSaving] = useState(false)

  // State — eksisterende runder
  const [rounds, setRounds] = useState<ChampionshipRound[]>([])
  const [loadingRounds, setLoadingRounds] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<Set<number>>(new Set())

  // Hent runde-oversigt for dropdown
  useEffect(() => {
    fetchRoundOptions()
    fetchRounds()
  }, [])

  // Hent kampe når runde vælges
  useEffect(() => {
    if (selectedRoundId) fetchMatchesForRound(selectedRoundId)
    else setAvailableMatches([])
  }, [selectedRoundId])

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
      // Expand range by 1 day each side to catch edge cases
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

  async function fetchRounds() {
    setLoadingRounds(true)
    try {
      const res = await fetch('/api/admin/championship/rounds', { headers: authHeader })
      const data = await res.json()
      if (data.rounds) setRounds(data.rounds)
    } catch { /* silent */ } finally {
      setLoadingRounds(false)
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

  async function saveRound() {
    if (!roundName.trim() || selectedMatches.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/championship/rounds', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roundName.trim(),
          betting_closes_at: bettingCloses || null,
          match_ids: selectedMatches.map((m) => m.id),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setRoundName('')
        setSelectedMatches([])
        setBettingCloses('')
        fetchRounds()
        router.refresh()
      } else {
        alert(data.error ?? 'Fejl ved oprettelse')
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
        setRounds((prev) => prev.filter((r) => r.id !== roundId))
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

  return (
    <div>
      <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Administration</p>
      <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-6">Mesterskabet</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* ── Venstre: Kamp-browser ──────────────────────────── */}
        <div>
          <h3 className="font-condensed font-bold text-ink text-sm uppercase tracking-wide mb-3">Kampe</h3>

          {/* Runde-dropdown */}
          <select
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            disabled={loadingRoundOptions}
            className="w-full font-body text-sm text-ink border border-warm-border bg-cream px-3 py-2 rounded-sm mb-4 cursor-pointer"
          >
            <option value="">Vælg en runde...</option>
            {roundOptions.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.tournament_name ?? 'Ukendt'} — {r.name} ({formatDateRange(r.first_kickoff, r.last_kickoff)})
              </option>
            ))}
          </select>

          {/* Kampliste */}
          {!selectedRoundId ? (
            <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Vælg en runde ovenfor for at se kampe</p>
            </div>
          ) : loadingMatches ? (
            <div className="text-center py-8">
              <span className="font-condensed text-sm text-warm-gray uppercase tracking-wide">Henter kampe...</span>
            </div>
          ) : availableMatches.length === 0 ? (
            <div className="border border-warm-border bg-cream-dark p-8 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Ingen kampe fundet for denne runde</p>
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
                            <span className="font-condensed text-[9px] font-bold text-gold uppercase tracking-wide shrink-0">
                              🔥
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-body text-xs text-warm-gray">
                            {formatKickoff(match.kickoff)}
                          </span>
                          {match.tournament_name && (
                            <span className="font-condensed text-[9px] font-bold text-warm-gray uppercase tracking-wide">
                              {match.tournament_name}
                            </span>
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
        </div>

        {/* ── Højre: Runde builder ───────────────────────────── */}
        <div>
          <h3 className="font-condensed font-bold text-ink text-sm uppercase tracking-wide mb-3">Ny runde</h3>

          <div className="border border-warm-border rounded-sm bg-cream p-4 space-y-4">
            {/* Rundenavn */}
            <div>
              <label className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] text-ink mb-1.5 block">
                Rundenavn
              </label>
              <input
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                placeholder="Fx Uge 16 · 2026"
                className="w-full font-body text-sm text-ink border border-warm-border bg-white px-4 py-3 rounded-sm placeholder:text-warm-gray/50 focus:outline-none focus:border-forest"
              />
            </div>

            {/* Betting deadline */}
            <div>
              <label className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] text-ink mb-1.5 block">
                Betting lukker
              </label>
              <input
                type="datetime-local"
                value={bettingCloses}
                onChange={(e) => setBettingCloses(e.target.value)}
                className="w-full font-body text-sm text-ink border border-warm-border bg-white px-4 py-3 rounded-sm focus:outline-none focus:border-forest"
              />
            </div>

            {/* Valgte kampe */}
            <div>
              <label className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] text-ink mb-1.5 block">
                Valgte kampe ({selectedMatches.length}/9)
              </label>
              {selectedMatches.length === 0 ? (
                <p className="font-body text-sm text-warm-gray py-4 text-center">
                  Tilføj kampe fra listen til venstre
                </p>
              ) : (
                <div className="space-y-1">
                  {selectedMatches.map((match, i) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-cream-dark rounded-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-condensed text-xs font-bold text-ink">
                          {i + 1}.
                        </span>
                        <span className="font-body text-xs text-ink ml-1.5 truncate">
                          {match.home_team} – {match.away_team}
                        </span>
                        {match.is_rivalry && (
                          <span className="ml-1">🔥</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeMatch(match.id)}
                        className="font-condensed text-[10px] text-vintage-red hover:text-vintage-red/70 transition-colors cursor-pointer shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gem */}
            <button
              onClick={saveRound}
              disabled={saving || !roundName.trim() || selectedMatches.length === 0}
              className="w-full font-condensed font-bold text-sm uppercase tracking-wide bg-forest text-cream px-6 py-3 rounded-sm hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              {saving ? 'Gemmer...' : 'Gem runde'}
            </button>
          </div>

          {/* ── Eksisterende runder ──────────────────────────── */}
          <h3 className="font-condensed font-bold text-ink text-sm uppercase tracking-wide mt-8 mb-3">Eksisterende runder</h3>

          {loadingRounds ? (
            <div className="text-center py-4">
              <span className="font-condensed text-sm text-warm-gray uppercase tracking-wide">Henter...</span>
            </div>
          ) : rounds.length === 0 ? (
            <div className="border border-warm-border bg-cream-dark p-6 text-center rounded-sm">
              <p className="font-body text-warm-gray text-sm">Ingen mesterskabsrunder endnu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round) => {
                const isConfirming = deleteConfirm === round.id
                const isDeleting = deleteLoading.has(round.id)
                return (
                  <div key={round.id} className="border border-warm-border rounded-sm bg-cream overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-condensed font-bold text-sm text-ink uppercase">{round.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`font-condensed text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${
                            round.status === 'upcoming' ? 'bg-gold/15 text-gold' :
                            round.status === 'open' ? 'bg-forest/10 text-forest' :
                            round.status === 'finished' ? 'bg-warm-border/40 text-warm-gray' :
                            'bg-forest/10 text-forest'
                          }`}>
                            {round.status}
                          </span>
                          <span className="font-body text-xs text-warm-gray">
                            {round.matches.length} kampe
                          </span>
                          {round.betting_closes_at && (
                            <span className="font-body text-xs text-warm-gray">
                              · lukker {formatDateTime(round.betting_closes_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        {isConfirming ? (
                          <span className="inline-flex items-center gap-2">
                            <button
                              onClick={() => deleteRound(round.id)}
                              disabled={isDeleting}
                              className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 bg-vintage-red text-cream rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity cursor-pointer"
                            >
                              {isDeleting ? 'Sletter...' : 'Ja, slet'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 border border-warm-border text-warm-gray rounded-sm hover:border-ink transition-colors cursor-pointer"
                            >
                              Annullér
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(round.id)}
                            className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 border border-vintage-red/40 text-vintage-red rounded-sm hover:bg-vintage-red hover:text-cream transition-colors cursor-pointer"
                          >
                            Slet
                          </button>
                        )}
                      </div>
                    </div>
                    {round.matches.length > 0 && (
                      <div className="border-t border-warm-border divide-y divide-warm-border">
                        {round.matches.map((m) => (
                          <div key={m.id} className="px-4 py-2 flex items-center justify-between text-xs">
                            <span className="font-body text-ink">{m.home_team} – {m.away_team}</span>
                            <span className="font-body text-warm-gray">{formatKickoff(m.kickoff)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
