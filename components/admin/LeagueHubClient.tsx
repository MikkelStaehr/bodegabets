'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
export type LeagueRow = {
  id: number
  name: string
  country: string
  bold_slug: string | null
  fixturedownload_slug: string | null
  last_synced_at: string | null
  total_matches: number
  /** Client-side sync status tracking (not persisted in DB) */
  sync_status?: string | null
  sync_error?: string | null
}

export type SyncLog = {
  id: number
  league_id: number
  synced_at: string
  matches_imported: number
  status: string
  message: string
}

/** "epl-2025" → "2025/26",  "championship-2024" → "2024/25",  null → "—" */
function parseSeason(slug: string | null): string {
  if (!slug) return '—'
  const m = slug.match(/(\d{4})$/)
  if (!m) return '—'
  const year = parseInt(m[1], 10)
  return `${year}/${String(year + 1).slice(2)}`
}

const COUNTRY_FLAGS: Record<string, string> = {
  England:     '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Germany:     '🇩🇪',
  Spain:       '🇪🇸',
  France:      '🇫🇷',
  Italy:       '🇮🇹',
  Netherlands: '🇳🇱',
  Turkey:      '🇹🇷',
  Denmark:     '🇩🇰',
  Europe:      '🇪🇺',
  World:       '🌍',
}

// Rækkefølge på lande i tabellen
const COUNTRY_ORDER = [
  'England', 'Germany', 'Spain', 'France', 'Italy',
  'Netherlands', 'Turkey', 'Denmark', 'Europe', 'World',
]

function groupByCountry(leagues: LeagueRow[]): { country: string; flag: string; leagues: LeagueRow[] }[] {
  const map = new Map<string, LeagueRow[]>()
  for (const l of leagues) {
    const c = l.country ?? 'Ukendt'
    if (!map.has(c)) map.set(c, [])
    map.get(c)!.push(l)
  }

  const ordered: { country: string; flag: string; leagues: LeagueRow[] }[] = []
  for (const c of COUNTRY_ORDER) {
    if (map.has(c)) {
      ordered.push({ country: c, flag: COUNTRY_FLAGS[c] ?? '🏳️', leagues: map.get(c)! })
      map.delete(c)
    }
  }
  // Evt. resterende lande
  for (const [c, ls] of map) {
    ordered.push({ country: c, flag: COUNTRY_FLAGS[c] ?? '🏳️', leagues: ls })
  }
  return ordered
}

interface Props {
  leagues: LeagueRow[]
  logs: SyncLog[]
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-condensed uppercase tracking-wide rounded-badge">
        ✅ OK
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-vintage-red/10 text-vintage-red text-xs font-condensed uppercase tracking-wide rounded-badge">
        ❌ Fejl
      </span>
    )
  }
  if (status === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gold/20 text-yellow-800 text-xs font-condensed uppercase tracking-wide rounded-badge">
        ⏳ Synker...
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-condensed uppercase tracking-wide rounded-badge">
      ⏳ Pending
    </span>
  )
}

export default function LeagueHubClient({ leagues, logs }: Props) {
  const router = useRouter()
  const [syncing, setSyncing]           = useState<Set<number>>(new Set())
  const [syncAll, setSyncAll]           = useState(false)
  const [leagueData, setLeagueData]     = useState<LeagueRow[]>(leagues)
  const [logModal, setLogModal]         = useState<{ league: LeagueRow } | null>(null)
  const [globalLogOpen, setGlobalLogOpen] = useState(false)
  const [feedback, setFeedback]         = useState<Record<number, string>>({})
  const [collapsed, setCollapsed]       = useState<Set<string>>(new Set())
  const [rebuildGameId, setRebuildGameId] = useState('')
  const [rebuilding, setRebuilding]      = useState(false)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)
  const [addingWorldCup, setAddingWorldCup] = useState(false)
  const [addWorldCupError, setAddWorldCupError] = useState<string | null>(null)

  const hasWorldCup = leagueData.some(
    (l) => l.name?.toLowerCase().includes('world cup')
  )

  async function addWorldCup() {
    if (hasWorldCup) return
    setAddingWorldCup(true)
    setAddWorldCupError(null)
    try {
      const res = await fetch('/api/admin/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'FIFA World Cup 2026',
          country: 'World',
          bold_slug: 'fifa-world-cup-2026',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddWorldCupError(data.error ?? 'Ukendt fejl')
      } else if (data.league) {
        const L = data.league as { id: number; name: string; country: string; bold_slug: string | null }
        setLeagueData((prev) => [...prev, {
          id: L.id,
          name: L.name,
          country: L.country,
          bold_slug: L.bold_slug,
          fixturedownload_slug: null,
          last_synced_at: null,
          total_matches: 0,
        }])
        router.refresh()
      }
    } catch {
      setAddWorldCupError('Netværksfejl')
    } finally {
      setAddingWorldCup(false)
    }
  }

  async function handleRebuildGame() {
    const id = parseInt(rebuildGameId, 10)
    if (!id) return
    setRebuilding(true)
    setRebuildResult(null)
    try {
      const res = await fetch('/api/admin/rebuild-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRebuildResult(`Fejl: ${data.error}`)
      } else {
        let msg = `${data.matches_created} kampe oprettet, ${data.matches_updated} opdateret`
        if (data.diagnostic) {
          msg += ` · league_matches: ${data.diagnostic.league_matches_count}, runder: ${data.diagnostic.rounds_count}`
        }
        if (data.debug) {
          msg += ` · Debug: ${data.debug.rounds_matched} runder matchet, ${data.debug.rounds_skipped} sprunget over, to_insert=${data.debug.to_insert}`
          if (data.debug.round_names_sample?.length) {
            msg += ` · LM ikke matchet: ${data.debug.round_names_sample.join(', ')}`
          }
          if (data.debug.db_round_names_sample?.length) {
            msg += ` · DB runder: ${data.debug.db_round_names_sample.join(', ')}`
          }
        }
        setRebuildResult(msg)
      }
    } catch {
      setRebuildResult('Netværksfejl')
    } finally {
      setRebuilding(false)
    }
  }

  function toggleCollapse(country: string) {
    setCollapsed((s) => {
      const n = new Set(s)
      n.has(country) ? n.delete(country) : n.add(country)
      return n
    })
  }

  function updateRow(leagueId: number, patch: Partial<LeagueRow>) {
    setLeagueData((rows) => rows.map((r) => r.id === leagueId ? { ...r, ...patch } : r))
  }

  async function syncLeague(leagueId: number) {
    setSyncing((s) => new Set(s).add(leagueId))
    setFeedback((f) => ({ ...f, [leagueId]: '' }))

    try {
      const res = await fetch('/api/admin/sync-league-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league_id: leagueId, rebuild_rounds: true }),
      })
      const data = await res.json()
      const msg = data.errors?.length
        ? `Fejl: ${data.errors[0]}`
        : `${data.synced} kampe synket, ${data.rounds_created} runder oprettet`
      setFeedback((f) => ({ ...f, [leagueId]: msg }))
      updateRow(leagueId, {
        sync_status:    data.errors?.length ? 'error' : 'ok',
        last_synced_at: new Date().toISOString(),
        total_matches:  data.synced ?? leagueData.find((l) => l.id === leagueId)?.total_matches ?? 0,
        sync_error:     data.errors?.[0] ?? null,
      })
    } catch {
      setFeedback((f) => ({ ...f, [leagueId]: 'Netværksfejl' }))
    } finally {
      setSyncing((s) => { const n = new Set(s); n.delete(leagueId); return n })
    }
  }

  async function syncAllLeagues() {
    setSyncAll(true)
    const syncable = leagueData.filter((l) => l.bold_slug)
    for (const l of syncable) {
      await syncLeague(l.id)
    }
    setSyncAll(false)
  }

  const logsForLeague = (leagueId: number) =>
    logs.filter((l) => l.league_id === leagueId).slice(0, 20)

  const canAutoSync = (l: LeagueRow) => !!l.bold_slug

  // ── Stats til header ────────────────────────────────────────────────────────
  const lastSyncedAll = leagueData
    .map((l) => l.last_synced_at)
    .filter(Boolean)
    .sort()
    .pop() ?? null

  const totalMatches = leagueData.reduce((s, l) => s + (l.total_matches ?? 0), 0)
  const okCount      = leagueData.filter((l) => l.sync_status === 'ok').length
  const errCount     = leagueData.filter((l) => l.sync_status === 'error').length
  const pendingCount = leagueData.filter((l) => !l.sync_status || l.sync_status === 'pending').length

  return (
    <>
      {/* ── Stats-banner ─────────────────────────────────────────────────────── */}
      <div className="rounded-sm border border-border overflow-hidden mb-6">
        {/* Øverste linje — mørkegrøn */}
        <div className="bg-forest text-cream px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="font-condensed text-[9px] uppercase tracking-[0.14em] text-cream/50 mb-0.5">Sidst synket</p>
              <p className="font-condensed font-bold text-sm text-cream">
                {lastSyncedAll ? formatDate(lastSyncedAll) : 'Aldrig'}
              </p>
            </div>
            <div className="w-px h-8 bg-cream/10 hidden sm:block" />
            <div>
              <p className="font-condensed text-[9px] uppercase tracking-[0.14em] text-cream/50 mb-0.5">Ligaer</p>
              <p className="font-condensed font-bold text-sm text-cream">{leagueData.length}</p>
            </div>
            <div className="w-px h-8 bg-cream/10 hidden sm:block" />
            <div>
              <p className="font-condensed text-[9px] uppercase tracking-[0.14em] text-cream/50 mb-0.5">Kampe i alt</p>
              <p className="font-condensed font-bold text-sm text-cream">{totalMatches.toLocaleString('da-DK')}</p>
            </div>
            <div className="w-px h-8 bg-cream/10 hidden sm:block" />
            <div className="flex items-center gap-3">
              {okCount > 0 && (
                <span className="flex items-center gap-1 font-condensed text-xs text-green-300">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  {okCount} OK
                </span>
              )}
              {errCount > 0 && (
                <span className="flex items-center gap-1 font-condensed text-xs text-red-300">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  {errCount} fejl
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 font-condensed text-xs text-cream/50">
                  <span className="w-2 h-2 rounded-full bg-cream/30 inline-block" />
                  {pendingCount} afventer
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setGlobalLogOpen(true)}
            className="flex items-center gap-2 font-condensed text-xs uppercase tracking-widest text-gold hover:text-cream transition-colors border border-gold/30 hover:border-cream/30 px-3 py-1.5 rounded-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vis sync log
          </button>
        </div>

        {/* Nedre linje — ligaer med fejl (vises kun ved fejl) */}
        {errCount > 0 && (
          <div className="bg-vintage-red/8 border-t border-vintage-red/20 px-5 py-2 flex items-center gap-2 flex-wrap">
            <span className="font-condensed text-[10px] uppercase tracking-widest text-vintage-red">Fejl i:</span>
            {leagueData.filter((l) => l.sync_status === 'error').map((l) => (
              <span key={l.id} className="font-condensed text-xs text-vintage-red bg-vintage-red/10 px-2 py-0.5 rounded-sm">
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Genbyg spilrum — separat kort */}
      <div className="mb-6 border border-border rounded-sm bg-cream-dark px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="font-condensed text-xs uppercase tracking-wider text-text-warm">
            Genbyg kampe for spilrum
          </label>
          <input
            type="number"
            min={1}
            value={rebuildGameId}
            onChange={(e) => setRebuildGameId(e.target.value)}
            placeholder="Spil-ID (fx 5)"
            className="w-28 px-3 py-2 text-sm border border-border rounded-sm bg-white text-ink font-body focus:outline-none focus:ring-2 focus:ring-forest focus:border-forest"
          />
          <button
            type="button"
            onClick={handleRebuildGame}
            disabled={rebuilding || !rebuildGameId.trim()}
            className="px-4 py-2 font-condensed text-xs uppercase tracking-widest bg-forest text-cream rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {rebuilding ? 'Kører...' : 'Genbyg'}
          </button>
          {rebuildResult && (
            <span className="font-body text-sm text-ink">{rebuildResult}</span>
          )}
        </div>
        <p className="font-body text-[11px] text-text-warm mt-2">
          Hvis et spilrum har runder men ingen kampe vises under «Afgiv bets», skriv spil-ID og klik Genbyg.
        </p>
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="font-body text-xs text-text-warm hidden sm:block">
          Ligaer med <strong>bold_slug</strong> og <strong>bold_phase_id</strong> synkes via Bold.dk.
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => {
              const allCountries = groupByCountry(leagueData).map((g) => g.country)
              const allCollapsed = allCountries.every((c) => collapsed.has(c))
              if (allCollapsed) {
                setCollapsed(new Set())
              } else {
                setCollapsed(new Set(allCountries))
              }
            }}
            className="px-4 py-2.5 border border-border text-text-warm font-condensed text-xs uppercase tracking-widest rounded-sm hover:bg-cream-dark transition-colors"
          >
            {groupByCountry(leagueData).every((g) => collapsed.has(g.country))
              ? 'Åbn alle'
              : 'Klap alle sammen'}
          </button>
          {!hasWorldCup && (
            <>
              <button
                onClick={addWorldCup}
                disabled={addingWorldCup}
                className="px-4 py-2.5 border border-gold text-gold font-condensed text-xs uppercase tracking-widest rounded-sm hover:bg-gold/10 disabled:opacity-50 transition-colors"
              >
                {addingWorldCup ? 'Tilføjer...' : '🌍 Tilføj VM 2026'}
              </button>
              {addWorldCupError && (
                <span className="text-xs text-vintage-red font-body">{addWorldCupError}</span>
              )}
            </>
          )}
          <button
            onClick={syncAllLeagues}
            disabled={syncAll}
            className="px-5 py-2.5 bg-forest text-cream font-condensed text-sm uppercase tracking-widest border-0 rounded-sm hover:opacity-85 disabled:opacity-50 transition-opacity"
          >
            {syncAll ? 'Synker...' : 'Sync alle'}
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-dark border-b border-border">
              <th className="text-left px-4 py-3 font-condensed uppercase tracking-wider text-xs text-text-warm">Liga</th>
              <th className="text-left px-4 py-3 font-condensed uppercase tracking-wider text-xs text-text-warm hidden sm:table-cell">Kilde</th>
              <th className="text-left px-4 py-3 font-condensed uppercase tracking-wider text-xs text-text-warm hidden md:table-cell">Sæson</th>
              <th className="text-right px-4 py-3 font-condensed uppercase tracking-wider text-xs text-text-warm">Kampe</th>
              <th className="text-left px-4 py-3 font-condensed uppercase tracking-wider text-xs text-text-warm hidden lg:table-cell">Sidst synket</th>
              <th className="text-left px-4 py-3 font-condensed uppercase tracking-wider text-xs text-text-warm">Status</th>
              <th className="text-right px-4 py-3 font-condensed uppercase tracking-wider text-xs text-text-warm">Handling</th>
            </tr>
          </thead>
          <tbody>
            {groupByCountry(leagueData).map(({ country, flag, leagues: group }) => (
              <Fragment key={country}>
                {/* Land-header */}
                {(() => {
                  const isCollapsed   = collapsed.has(country)
                  const totalMatches  = group.reduce((s, l) => s + (l.total_matches ?? 0), 0)
                  const allOk         = group.every((l) => l.sync_status === 'ok')
                  const anyError      = group.some((l)  => l.sync_status === 'error')
                  const lastSynced    = group
                    .map((l) => l.last_synced_at)
                    .filter(Boolean)
                    .sort()
                    .at(-1) ?? null
                  const statusColor = anyError ? 'text-vintage-red' : allOk ? 'text-forest' : 'text-text-warm'

                  return (
                    <tr key={`country-${country}`} className="bg-forest/8 border-b border-border">
                      <td colSpan={7} className="px-4 py-2.5">
                        <button
                          onClick={() => toggleCollapse(country)}
                          className="w-full flex items-center gap-3 text-left group"
                        >
                          {/* Chevron */}
                          <svg
                            className={`w-3.5 h-3.5 text-text-warm transition-transform shrink-0 ${isCollapsed ? '-rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>

                          {/* Flag + land */}
                          <span className="text-base leading-none shrink-0">{flag}</span>
                          <span className="font-condensed font-bold text-xs uppercase tracking-widest text-forest">
                            {country}
                          </span>
                          <span className="font-condensed text-xs text-text-warm">
                            {group.length} {group.length === 1 ? 'liga' : 'ligaer'}
                          </span>

                          {/* Collapsed summary */}
                          {isCollapsed && (
                            <span className="ml-auto flex items-center gap-4 text-xs font-condensed">
                              <span className="text-text-warm hidden sm:inline">
                                {totalMatches.toLocaleString('da-DK')} kampe
                              </span>
                              <span className="text-text-warm hidden md:inline">
                                {lastSynced ? formatDate(lastSynced) : '—'}
                              </span>
                              <span className={statusColor}>
                                {anyError ? '❌ Fejl' : allOk ? '✅ OK' : '⏳ Pending'}
                              </span>
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })()}

                {/* Liga-rækker — skjult når collapsed */}
                {!collapsed.has(country) && group.map((league) => {
                  const isSyncing = syncing.has(league.id)
                  const busy     = isSyncing
                  const source   = league.bold_slug ? 'bold.dk' : '—'

                  return (
                    <tr
                      key={league.id}
                      className={`border-b border-border last:border-0 bg-cream hover:bg-cream-dark/20 transition-colors ${busy ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 pl-8">
                        <div className="font-body font-medium text-primary">{league.name}</div>
                        {league.sync_error && !feedback[league.id] && (
                          <div className="text-xs text-vintage-red mt-0.5 font-body truncate max-w-xs" title={league.sync_error}>
                            {league.sync_error}
                          </div>
                        )}
                        {feedback[league.id] && (
                          <div className={`text-xs mt-0.5 font-body ${feedback[league.id].startsWith('Fejl') ? 'text-vintage-red' : 'text-forest'}`}>
                            {feedback[league.id]}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="font-condensed text-xs text-text-warm uppercase tracking-wide">{source}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-condensed font-bold text-sm text-primary">
                          {parseSeason(league.bold_slug)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-condensed font-bold text-base">
                        {league.total_matches ?? 0}
                      </td>
                      <td className="px-4 py-3 font-body text-text-warm text-xs hidden lg:table-cell">
                        {formatDate(league.last_synced_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={busy ? 'syncing' : league.sync_status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {canAutoSync(league) ? (
                            <button
                              onClick={() => syncLeague(league.id)}
                              disabled={busy}
                              className="px-3 py-1.5 bg-forest text-cream font-condensed text-xs uppercase tracking-wide rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity"
                            >
                              {isSyncing ? '...' : 'Sync'}
                            </button>
                          ) : (
                            <span className="text-xs text-text-warm font-body">Sæt bold_phase_id</span>
                          )}
                          <button
                            onClick={() => setLogModal({ league })}
                            className="px-3 py-1.5 border border-border text-text-warm font-condensed text-xs uppercase tracking-wide rounded-sm hover:bg-cream-dark transition-colors"
                          >
                            Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Global sync log modal */}
      {globalLogOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setGlobalLogOpen(false)}
        >
          <div
            className="bg-cream rounded-sm border border-border w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg text-forest">Sync log</h2>
                <p className="font-body text-xs text-text-warm mt-0.5">{logs.length} entries — nyeste øverst</p>
              </div>
              <button onClick={() => setGlobalLogOpen(false)} className="text-text-warm hover:text-primary text-xl leading-none">×</button>
            </div>

            {/* Søjleoverskrifter */}
            <div className="grid grid-cols-[90px_1fr_80px_60px] gap-3 px-6 py-2 bg-cream-dark border-b border-border">
              {['Tidspunkt', 'Liga · Besked', 'Kampe', 'Status'].map((h) => (
                <span key={h} className="font-condensed text-[9px] uppercase tracking-[0.12em] text-text-warm">{h}</span>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {logs.length === 0 ? (
                <div className="px-6 py-10 text-center text-text-warm font-body text-sm">
                  Ingen sync-historik endnu
                </div>
              ) : (
                logs.map((log) => {
                  const league = leagueData.find((l) => l.id === log.league_id)
                  return (
                    <div key={log.id} className="grid grid-cols-[90px_1fr_80px_60px] gap-3 px-6 py-3 items-start hover:bg-cream/60 transition-colors">
                      <div className="font-body text-[11px] text-text-warm leading-tight pt-0.5">
                        {formatDate(log.synced_at)}
                      </div>
                      <div className="min-w-0">
                        {league && (
                          <span className="font-condensed text-[10px] uppercase tracking-wide text-forest bg-forest/10 px-1.5 py-0.5 rounded-sm mr-1.5">
                            {league.name}
                          </span>
                        )}
                        <span className="font-body text-sm text-primary wrap-break-word">{log.message}</span>
                      </div>
                      <div className="font-condensed text-sm text-text-warm text-right">
                        {log.matches_imported > 0 ? `+${log.matches_imported}` : '—'}
                      </div>
                      <div>
                        {log.status === 'ok'
                          ? <span className="text-green-600 text-xs font-condensed uppercase">✓ OK</span>
                          : <span className="text-vintage-red text-xs font-condensed uppercase">✗ Fejl</span>
                        }
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Log modal */}
      {logModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setLogModal(null)}
        >
          <div
            className="bg-cream rounded-sm border border-border w-full max-w-lg max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-forest">
                Sync historik — {logModal.league.name}
              </h2>
              <button onClick={() => setLogModal(null)} className="text-text-warm hover:text-primary text-lg leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {logsForLeague(logModal.league.id).length === 0 ? (
                <div className="px-6 py-8 text-center text-text-warm font-body text-sm">
                  Ingen sync-historik endnu
                </div>
              ) : (
                logsForLeague(logModal.league.id).map((log) => (
                  <div key={log.id} className="px-6 py-3 flex items-start gap-3">
                    <span className="text-sm mt-0.5">{log.status === 'ok' ? '✅' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-xs text-text-warm">{formatDate(log.synced_at)}</div>
                      <div className="font-body text-sm text-primary mt-0.5 wrap-break-word">{log.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
