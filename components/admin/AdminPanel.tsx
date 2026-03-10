'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type League = {
  id: number
  name: string
  country: string
  bold_slug: string | null
}

type RoundRow = {
  id: number
  name: string
  status: 'upcoming' | 'open' | 'closed' | 'finished'
  betting_closes_at: string | null
  game_id: number
  game_name: string
  league_name: string
  match_count: number
}

type MatchRow = {
  id: number
  round_id: number
  round_name: string
  game_name: string
  home_team: string
  away_team: string
  kickoff_at: string | null
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'finished'
  existing_sidebet_types: string[]
}

type GameRow = {
  id: number
  name: string
  status: string
  invite_code: string
  created_at: string
  league_name: string
  member_count: number
  round_count: number
}

type Props = {
  leagues: League[]
  games: GameRow[]
  rounds: RoundRow[]
  matches: MatchRow[]
  adminSecret: string
}

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Kommende',
  open: 'Åben',
  closed: 'Lukket',
  finished: 'Færdig',
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'text-gold bg-gold/10 border-gold/30',
  open: 'text-forest bg-forest/10 border-forest/30',
  closed: 'text-vintage-red bg-vintage-red/10 border-vintage-red/30',
  finished: 'text-warm-gray bg-warm-border/50 border-warm-border',
}

function formatDeadline(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('da-DK', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const BET_TYPE_LABELS: Record<string, string> = {
  first_scorer:  'Første målscorer',
  total_goals:   'Antal mål',
  yellow_cards:  'Gule kort',
  red_cards:     'Røde kort',
  btts:          'Begge hold scorer',
  halftime:      'Halvtidsresultat',
}

const SIDEBET_TYPES = Object.keys(BET_TYPE_LABELS)

export default function AdminPanel({ leagues, games, rounds, matches, adminSecret }: Props) {
  const router = useRouter()
  const [syncLoading, setSyncLoading] = useState<Set<string>>(new Set())
  const [roundLoading, setRoundLoading] = useState<Set<number>>(new Set())
  const [messages, setMessages] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({})

  // Spilrum — slet
  const [deleteLoading, setDeleteLoading] = useState<Set<number>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Sektion 3 — side-bets
  const [sbMatchId, setSbMatchId] = useState<string>('')
  const [sbType, setSbType] = useState<string>('')
  const [sbLoading, setSbLoading] = useState(false)

  // Sektion 4 — resultater
  const [scoreInputs, setScoreInputs] = useState<Record<number, { home: string; away: string; ht_home: string; ht_away: string; first_scorer: string; yellow: string; red: string }>>({})
  const [scoreLoading, setScoreLoading] = useState<Set<number>>(new Set())

  function setMsg(key: string, type: 'ok' | 'err', text: string) {
    setMessages((prev) => ({ ...prev, [key]: { type, text } }))
    setTimeout(() => setMessages((prev) => { const n = { ...prev }; delete n[key]; return n }), 5000)
  }

  const authHeader = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSecret}` }

  // ── Slet spilrum ─────────────────────────────────────────────────────────────

  async function deleteGame(gameId: number) {
    setDeleteLoading((s) => new Set(s).add(gameId))
    try {
      const res = await fetch(`/api/admin/games/${gameId}`, { method: 'DELETE', headers: authHeader })
      const data = await res.json()
      if (data.ok) {
        setMsg(`game-${gameId}`, 'ok', 'Spilrum slettet')
        setDeleteConfirm(null)
        router.refresh()
      } else {
        setMsg(`game-${gameId}`, 'err', data.error || 'Fejl ved sletning')
      }
    } catch {
      setMsg(`game-${gameId}`, 'err', 'Netværksfejl')
    } finally {
      setDeleteLoading((s) => { const n = new Set(s); n.delete(gameId); return n })
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────────

  async function runSync(key: string, body: object) {
    setSyncLoading((s) => new Set(s).add(key))
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST', headers: authHeader, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.ok) {
        setMsg(key, 'ok', data.output?.split('\n').pop() || 'Sync gennemført')
        router.refresh()
      } else {
        setMsg(key, 'err', data.error || 'Sync fejlede')
      }
    } catch {
      setMsg(key, 'err', 'Netværksfejl')
    } finally {
      setSyncLoading((s) => { const n = new Set(s); n.delete(key); return n })
    }
  }

  // ── Rundestatus ──────────────────────────────────────────────────────────────

  async function setRoundStatus(roundId: number, status: string) {
    setRoundLoading((s) => new Set(s).add(roundId))
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}`, {
        method: 'PATCH', headers: authHeader, body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsg(`round-${roundId}`, 'ok', `Status sat til "${STATUS_LABELS[status]}"`)
        router.refresh()
      } else {
        setMsg(`round-${roundId}`, 'err', data.error || 'Fejl')
      }
    } catch {
      setMsg(`round-${roundId}`, 'err', 'Netværksfejl')
    } finally {
      setRoundLoading((s) => { const n = new Set(s); n.delete(roundId); return n })
    }
  }

  // ── Side-bet options ─────────────────────────────────────────────────────────

  async function addSidebetOption() {
    if (!sbMatchId || !sbType) return
    setSbLoading(true)
    try {
      const res = await fetch('/api/admin/sidebet-options', {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ match_id: parseInt(sbMatchId), bet_type: sbType }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsg('sidebet', 'ok', 'Side-bet option tilføjet')
        setSbMatchId('')
        setSbType('')
        router.refresh()
      } else {
        setMsg('sidebet', 'err', data.error || 'Fejl')
      }
    } catch {
      setMsg('sidebet', 'err', 'Netværksfejl')
    } finally {
      setSbLoading(false)
    }
  }

  async function removeSidebetOption(optionId: number) {
    try {
      await fetch('/api/admin/sidebet-options', {
        method: 'DELETE', headers: authHeader,
        body: JSON.stringify({ id: optionId }),
      })
      router.refresh()
    } catch { /* ignore */ }
  }

  // ── Resultater ────────────────────────────────────────────────────────────────

  function getScoreInput(matchId: number) {
    return scoreInputs[matchId] ?? { home: '', away: '', ht_home: '', ht_away: '', first_scorer: '', yellow: '', red: '' }
  }

  function updateScoreInput(matchId: number, field: string, value: string) {
    setScoreInputs((prev) => ({
      ...prev,
      [matchId]: { ...getScoreInput(matchId), [field]: value },
    }))
  }

  async function saveMatchResult(matchId: number) {
    const inp = getScoreInput(matchId)
    if (inp.home === '' || inp.away === '') {
      setMsg(`match-${matchId}`, 'err', 'Hjemme og ude score er påkrævet')
      return
    }
    setScoreLoading((s) => new Set(s).add(matchId))
    try {
      const body: Record<string, unknown> = {
        home_score: parseInt(inp.home),
        away_score: parseInt(inp.away),
      }
      if (inp.ht_home !== '') body.home_ht_score = parseInt(inp.ht_home)
      if (inp.ht_away !== '') body.away_ht_score = parseInt(inp.ht_away)
      if (inp.first_scorer.trim()) body.first_scorer = inp.first_scorer.trim()
      if (inp.yellow !== '') body.yellow_cards = parseInt(inp.yellow)
      if (inp.red !== '') body.red_cards = parseInt(inp.red)

      const res = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'PATCH', headers: authHeader, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        setMsg(`match-${matchId}`, 'ok', `${data.match.home_score}–${data.match.away_score} gemt`)
        router.refresh()
      } else {
        setMsg(`match-${matchId}`, 'err', data.error || 'Fejl')
      }
    } catch {
      setMsg(`match-${matchId}`, 'err', 'Netværksfejl')
    } finally {
      setScoreLoading((s) => { const n = new Set(s); n.delete(matchId); return n })
    }
  }

  // ── Beregn point ─────────────────────────────────────────────────────────────

  async function calculateRound(roundId: number, gameId: number) {
    setRoundLoading((s) => new Set(s).add(roundId))
    try {
      const res = await fetch('/api/admin/calculate-round', {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ round_id: roundId, game_id: gameId }),
      })
      const data = await res.json()
      if (data.ok) {
        const summary = data.results?.length
          ? `${data.results.length} spillere opdateret`
          : 'Ingen bets at beregne'
        setMsg(`round-${roundId}`, 'ok', `Point beregnet — ${summary}`)
        router.refresh()
      } else {
        setMsg(`round-${roundId}`, 'err', data.error || 'Fejl ved beregning')
      }
    } catch {
      setMsg(`round-${roundId}`, 'err', 'Netværksfejl')
    } finally {
      setRoundLoading((s) => { const n = new Set(s); n.delete(roundId); return n })
    }
  }

  const syncableLeagues = leagues.filter((l) => l.bold_slug)

  return (
    <div className="space-y-10">

      {/* ── Sektion 1: Sync ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Data</p>
            <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide">Sync</h2>
          </div>
          <AdminBtn
            onClick={() => runSync('all', { all: true })}
            loading={syncLoading.has('all')}
            variant="primary"
          >
            Kør fuld sync
          </AdminBtn>
        </div>

        {messages['all'] && <MsgBanner msg={messages['all']} />}

        <div className="border border-warm-border bg-cream-dark divide-y divide-warm-border">
          {syncableLeagues.length === 0 ? (
            <div className="px-5 py-4">
              <p className="font-body text-warm-gray text-sm">Ingen ligaer med bold_slug sat i databasen.</p>
            </div>
          ) : (
            syncableLeagues.map((league) => {
              const key = `league-${league.id}`
              return (
                <div key={league.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div>
                    <span className="font-condensed font-semibold text-ink text-sm">{league.name}</span>
                    <span className="font-body text-warm-gray text-xs ml-2">{league.country}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {messages[key] && <MsgBanner msg={messages[key]} inline />}
                    <AdminBtn
                      onClick={() => runSync(key, { league_id: league.id })}
                      loading={syncLoading.has(key)}
                      variant="secondary"
                      size="sm"
                    >
                      Sync
                    </AdminBtn>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ── Sektion 2: Spilrum ──────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Administrér</p>
          <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide">Spilrum</h2>
        </div>

        {games.length === 0 ? (
          <div className="border border-warm-border bg-cream-dark p-10 text-center">
            <p className="font-body text-warm-gray text-sm">Ingen spilrum oprettet endnu.</p>
          </div>
        ) : (
          <div className="border border-warm-border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream-dark border-b border-warm-border">
                  {['ID', 'Navn', 'Liga', 'Kode', 'Deltagere', 'Runder', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border">
                {games.map((game) => {
                  const isConfirming = deleteConfirm === game.id
                  const isDeleting = deleteLoading.has(game.id)
                  const msg = messages[`game-${game.id}`]

                  return (
                    <tr key={game.id} className="bg-cream hover:bg-cream-dark/40 transition-colors">
                      <td className="px-4 py-3 font-condensed text-warm-gray text-sm">{game.id}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`/games/${game.id}`}
                          className="font-body text-sm font-500 text-ink hover:text-forest transition-colors"
                        >
                          {game.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-warm-gray">{game.league_name}</td>
                      <td className="px-4 py-3 font-condensed text-sm tracking-widest text-ink">{game.invite_code}</td>
                      <td className="px-4 py-3 font-condensed text-sm text-center text-ink">{game.member_count}</td>
                      <td className="px-4 py-3 font-condensed text-sm text-center text-ink">{game.round_count}</td>
                      <td className="px-4 py-3">
                        <span className={`font-condensed text-xs uppercase tracking-wide px-2 py-0.5 rounded-sm border ${
                          game.status === 'active'
                            ? 'text-forest bg-forest/10 border-forest/30'
                            : 'text-warm-gray bg-warm-border/40 border-warm-border'
                        }`}>
                          {game.status === 'active' ? 'Aktiv' : 'Afsluttet'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {msg && (
                          <span className={`font-body text-xs mr-3 ${msg.type === 'ok' ? 'text-forest' : 'text-vintage-red'}`}>
                            {msg.text}
                          </span>
                        )}
                        {isConfirming ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-body text-xs text-vintage-red">Er du sikker?</span>
                            <button
                              onClick={() => deleteGame(game.id)}
                              disabled={isDeleting}
                              className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 bg-vintage-red text-cream rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity"
                            >
                              {isDeleting ? 'Sletter...' : 'Ja, slet'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 border border-warm-border text-warm-gray rounded-sm hover:border-ink transition-colors"
                            >
                              Annullér
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(game.id)}
                            className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 border border-vintage-red/40 text-vintage-red rounded-sm hover:bg-vintage-red hover:text-cream transition-colors"
                          >
                            Slet
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sektion 3: Runder ────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Spilrum</p>
          <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide">Runder</h2>
        </div>

        {rounds.length === 0 ? (
          <div className="border border-warm-border bg-cream-dark p-10 text-center">
            <p className="font-body text-warm-gray text-sm">Ingen runder oprettet endnu — kør en sync.</p>
          </div>
        ) : (
          <div className="border border-warm-border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream-dark border-b border-warm-border">
                  {['Spilrum', 'Liga', 'Runde', 'Status', 'Deadline', 'Kampe', 'Handling'].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border">
                {rounds.map((round) => {
                  const loading = roundLoading.has(round.id)
                  const msg = messages[`round-${round.id}`]
                  return (
                    <>
                      <tr key={round.id} className="bg-cream hover:bg-cream-dark/50 transition-colors">
                        <td className="px-4 py-3 font-condensed text-sm text-ink whitespace-nowrap">{round.game_name}</td>
                        <td className="px-4 py-3 font-body text-xs text-warm-gray whitespace-nowrap">{round.league_name}</td>
                        <td className="px-4 py-3 font-condensed font-semibold text-sm text-ink whitespace-nowrap">{round.name}</td>
                        <td className="px-4 py-3">
                          <span className={`font-condensed text-xs uppercase tracking-wide border px-2 py-0.5 whitespace-nowrap ${STATUS_COLORS[round.status]}`}
                            style={{ borderRadius: '2px' }}>
                            {STATUS_LABELS[round.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-body text-xs text-warm-gray whitespace-nowrap">
                          {formatDeadline(round.betting_closes_at)}
                        </td>
                        <td className="px-4 py-3 font-condensed text-sm text-ink text-center">{round.match_count}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {round.status === 'upcoming' && (
                              <AdminBtn size="xs" variant="primary" loading={loading}
                                onClick={() => setRoundStatus(round.id, 'open')}>
                                Åbn bets
                              </AdminBtn>
                            )}
                            {round.status === 'open' && (
                              <AdminBtn size="xs" variant="secondary" loading={loading}
                                onClick={() => setRoundStatus(round.id, 'closed')}>
                                Luk bets
                              </AdminBtn>
                            )}
                            {round.status === 'closed' && (
                              <>
                                <AdminBtn size="xs" variant="primary" loading={loading}
                                  onClick={() => calculateRound(round.id, round.game_id)}>
                                  Beregn pt
                                </AdminBtn>
                                <AdminBtn size="xs" variant="secondary" loading={loading}
                                  onClick={() => setRoundStatus(round.id, 'finished')}>
                                  Marker færdig
                                </AdminBtn>
                              </>
                            )}
                            {round.status === 'finished' && (
                              <span className="font-condensed text-xs text-warm-gray">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {msg && (
                        <tr key={`msg-${round.id}`} className="bg-cream">
                          <td colSpan={7} className="px-4 py-1.5">
                            <MsgBanner msg={msg} inline />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sektion 3: Side-bet options ─────────────────────────── */}
      <section>
        <div className="mb-4">
          <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Kampe</p>
          <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide">Side-bet options</h2>
        </div>

        <div className="border border-warm-border bg-cream-dark p-5 space-y-4">
          {/* Tilføj ny option */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
              <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray mb-1.5">Kamp</label>
              <select
                value={sbMatchId}
                onChange={(e) => setSbMatchId(e.target.value)}
                className="w-full bg-white border border-warm-border text-ink font-body text-sm px-3 py-2.5 outline-none focus:border-forest"
                style={{ borderRadius: '2px' }}
              >
                <option value="">Vælg kamp...</option>
                {matches.filter((m) => m.status === 'scheduled').map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.game_name} · {m.round_name} · {m.home_team} vs {m.away_team}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray mb-1.5">Type</label>
              <select
                value={sbType}
                onChange={(e) => setSbType(e.target.value)}
                className="w-full bg-white border border-warm-border text-ink font-body text-sm px-3 py-2.5 outline-none focus:border-forest"
                style={{ borderRadius: '2px' }}
              >
                <option value="">Vælg type...</option>
                {SIDEBET_TYPES.map((t) => (
                  <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <AdminBtn
              onClick={addSidebetOption}
              loading={sbLoading}
              disabled={!sbMatchId || !sbType}
              variant="primary"
              size="sm"
            >
              Tilføj
            </AdminBtn>
          </div>

          {messages['sidebet'] && <MsgBanner msg={messages['sidebet']} />}

          {/* Eksisterende options */}
          {matches.some((m) => m.existing_sidebet_types.length > 0) && (
            <div className="pt-3 border-t border-warm-border">
              <p className="font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray mb-3">Aktive side-bets</p>
              <div className="space-y-2">
                {matches.filter((m) => m.existing_sidebet_types.length > 0).map((m) => (
                  <div key={m.id} className="flex items-start gap-3 bg-cream border border-warm-border px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-condensed font-semibold text-sm text-ink">{m.home_team} vs {m.away_team}</span>
                      <span className="font-body text-xs text-warm-gray ml-2">{m.game_name} · {m.round_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.existing_sidebet_types.map((t) => (
                        <span key={t} className="font-condensed text-xs uppercase tracking-wide bg-forest/10 text-forest border border-forest/20 px-2 py-0.5"
                          style={{ borderRadius: '2px' }}>
                          {BET_TYPE_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Sektion 4: Resultater ───────────────────────────────── */}
      <section>
        <div className="mb-4">
          <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Kampe</p>
          <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide">Indtast resultater</h2>
        </div>

        {matches.filter((m) => m.status === 'scheduled').length === 0 ? (
          <div className="border border-warm-border bg-cream-dark p-8 text-center">
            <p className="font-body text-warm-gray text-sm">Ingen kampe mangler resultater.</p>
          </div>
        ) : (
          <div className="border border-warm-border divide-y divide-warm-border">
            {matches.filter((m) => m.status === 'scheduled').map((match) => {
              const inp = getScoreInput(match.id)
              const loading = scoreLoading.has(match.id)
              const msg = messages[`match-${match.id}`]
              return (
                <div key={match.id} className="bg-cream px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <span className="font-condensed font-bold text-ink text-sm">{match.home_team} vs {match.away_team}</span>
                      <span className="font-body text-xs text-warm-gray ml-2">{match.game_name} · {match.round_name}</span>
                    </div>
                    {msg && <MsgBanner msg={msg} inline />}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-end">
                    <ScoreInput label="Hjemme *" value={inp.home} onChange={(v) => updateScoreInput(match.id, 'home', v)} />
                    <ScoreInput label="Ude *" value={inp.away} onChange={(v) => updateScoreInput(match.id, 'away', v)} />
                    <ScoreInput label="HT hjemme" value={inp.ht_home} onChange={(v) => updateScoreInput(match.id, 'ht_home', v)} />
                    <ScoreInput label="HT ude" value={inp.ht_away} onChange={(v) => updateScoreInput(match.id, 'ht_away', v)} />
                    <ScoreInput label="Gule kort" value={inp.yellow} onChange={(v) => updateScoreInput(match.id, 'yellow', v)} />
                    <ScoreInput label="Røde kort" value={inp.red} onChange={(v) => updateScoreInput(match.id, 'red', v)} />
                    <div className="flex flex-col gap-1">
                      <label className="font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray">Første scorer</label>
                      <input
                        type="text"
                        value={inp.first_scorer}
                        onChange={(e) => updateScoreInput(match.id, 'first_scorer', e.target.value)}
                        placeholder="Navn"
                        className="bg-white border border-warm-border text-ink font-body text-sm px-2.5 py-2 outline-none focus:border-forest w-full"
                        style={{ borderRadius: '2px' }}
                      />
                    </div>
                  </div>

                  <AdminBtn
                    onClick={() => saveMatchResult(match.id)}
                    loading={loading}
                    disabled={inp.home === '' || inp.away === ''}
                    variant="primary"
                    size="sm"
                  >
                    Gem resultat
                  </AdminBtn>
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}

// ── Hjælpekomponenter ─────────────────────────────────────────────────────────

function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-warm-border text-ink font-condensed font-bold text-sm px-2.5 py-2 outline-none focus:border-forest w-full text-center"
        style={{ borderRadius: '2px' }}
      />
    </div>
  )
}

function AdminBtn({
  children, onClick, loading, disabled, variant = 'primary', size = 'md',
}: {
  children: React.ReactNode
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'xs' | 'sm' | 'md'
}) {
  const base = 'inline-flex items-center gap-1.5 font-condensed font-semibold uppercase tracking-[0.08em] transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'
  const sizes = { xs: 'text-[10px] px-2.5 py-1', sm: 'text-xs px-4 py-1.5', md: 'text-sm px-5 py-2.5' }
  const variants = {
    primary: 'bg-forest text-cream hover:opacity-85',
    secondary: 'bg-transparent border border-ink text-ink hover:bg-ink hover:text-cream',
    danger: 'bg-vintage-red text-cream hover:opacity-85',
  }

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={[base, sizes[size], variants[variant]].join(' ')}
      style={{ borderRadius: '2px' }}
    >
      {loading && (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}

function MsgBanner({ msg, inline }: { msg: { type: 'ok' | 'err'; text: string }; inline?: boolean }) {
  const colors = msg.type === 'ok'
    ? 'text-forest bg-forest/10 border-forest/20'
    : 'text-vintage-red bg-vintage-red/10 border-vintage-red/20'
  return (
    <div className={`font-body text-xs border px-3 py-1.5 ${colors} ${inline ? 'inline-block' : 'block mb-3'}`}
      style={{ borderRadius: '2px' }}>
      {msg.text}
    </div>
  )
}
