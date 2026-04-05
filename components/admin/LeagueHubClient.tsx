'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/dateUtils'

export type SeasonRow = {
  id: number
  bold_phase_id: number | null
  match_count: number
}

export type TournamentRow = {
  id: number
  name: string
  logo_url: string | null
  seasons: SeasonRow[]
}

interface Props {
  tournaments: TournamentRow[]
  lastSync: string | null
}



export default function LeagueHubClient({ tournaments, lastSync }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState<Set<number>>(new Set())
  const [syncingAll, setSyncingAll] = useState(false)
  const [feedback, setFeedback] = useState<Record<number, { ok: boolean; text: string }>>({})
  const [rebuildGameId, setRebuildGameId] = useState('')
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)

  const totalMatches = tournaments.reduce(
    (s, t) => s + t.seasons.reduce((ss, se) => ss + se.match_count, 0), 0
  )
  const totalSeasons = tournaments.reduce(
    (s, t) => s + t.seasons.filter((se) => se.bold_phase_id != null).length, 0
  )

  async function syncSeason(seasonId: number) {
    setSyncing((s) => new Set(s).add(seasonId))
    setFeedback((f) => { const n = { ...f }; delete n[seasonId]; return n })
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: seasonId }),
      })
      const data = await res.json()
      if (!res.ok || data.errors?.length) {
        setFeedback((f) => ({ ...f, [seasonId]: { ok: false, text: data.errors?.[0] ?? data.error ?? 'Fejl' } }))
      } else {
        setFeedback((f) => ({ ...f, [seasonId]: { ok: true, text: `${data.synced} kampe synket, +${data.matches_created} nye` } }))
        router.refresh()
      }
    } catch {
      setFeedback((f) => ({ ...f, [seasonId]: { ok: false, text: 'Netværksfejl' } }))
    } finally {
      setSyncing((s) => { const n = new Set(s); n.delete(seasonId); return n })
    }
  }

  async function syncAll() {
    setSyncingAll(true)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      if (res.ok) router.refresh()
    } catch {
      // ignore
    } finally {
      setSyncingAll(false)
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
        setRebuildResult(`${data.matches_created} kampe oprettet, ${data.matches_updated} opdateret`)
      }
    } catch {
      setRebuildResult('Netværksfejl')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <>
      {/* Stats banner */}
      <div className="rounded-sm border border-border overflow-hidden mb-6">
        <div className="bg-forest text-cream px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="font-condensed text-[9px] uppercase tracking-[0.14em] text-cream/50 mb-0.5">Sidst synket</p>
              <p className="font-condensed font-bold text-sm text-cream">{formatDateTime(lastSync)}</p>
            </div>
            <div className="w-px h-8 bg-cream/10 hidden sm:block" />
            <div>
              <p className="font-condensed text-[9px] uppercase tracking-[0.14em] text-cream/50 mb-0.5">Aktive sæsoner</p>
              <p className="font-condensed font-bold text-sm text-cream">{totalSeasons}</p>
            </div>
            <div className="w-px h-8 bg-cream/10 hidden sm:block" />
            <div>
              <p className="font-condensed text-[9px] uppercase tracking-[0.14em] text-cream/50 mb-0.5">Kampe i alt</p>
              <p className="font-condensed font-bold text-sm text-cream">{totalMatches.toLocaleString('da-DK')}</p>
            </div>
          </div>
          <button
            onClick={syncAll}
            disabled={syncingAll}
            className="px-5 py-2 bg-cream/10 hover:bg-cream/20 text-cream font-condensed text-xs uppercase tracking-widest border border-cream/20 rounded-sm disabled:opacity-50 transition-colors"
          >
            {syncingAll ? 'Synker...' : 'Sync alle'}
          </button>
        </div>
      </div>

      {/* Rebuild game */}
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
          Hvis et spilrum har runder men ingen kampe vises, skriv spil-ID og klik Genbyg.
        </p>
      </div>

      {/* Tournament list */}
      <div className="space-y-3">
        {tournaments.length === 0 && (
          <div className="border border-border rounded-sm bg-cream p-8 text-center font-body text-text-warm text-sm">
            Ingen turneringer med bold_phase_id konfigureret
          </div>
        )}
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="border border-border rounded-sm overflow-hidden">
            {/* Tournament header */}
            <div className="bg-cream-dark border-b border-border px-4 py-3 flex items-center gap-3">
              {tournament.logo_url && (
                <img
                  src={tournament.logo_url}
                  alt=""
                  className="w-5 h-5 object-contain shrink-0"
                />
              )}
              <h3 className="font-condensed font-bold text-sm text-forest uppercase tracking-wide">
                {tournament.name}
              </h3>
              <span className="font-condensed text-xs text-text-warm ml-auto">
                {tournament.seasons.length} sæson{tournament.seasons.length !== 1 ? 'er' : ''}
              </span>
            </div>

            {/* Season rows */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-cream">
                  <th className="text-left px-4 py-2 font-condensed text-[10px] uppercase tracking-wider text-text-warm">Sæson ID</th>
                  <th className="text-left px-4 py-2 font-condensed text-[10px] uppercase tracking-wider text-text-warm">Bold phase_id</th>
                  <th className="text-right px-4 py-2 font-condensed text-[10px] uppercase tracking-wider text-text-warm">Kampe</th>
                  <th className="text-right px-4 py-2 font-condensed text-[10px] uppercase tracking-wider text-text-warm">Handling</th>
                </tr>
              </thead>
              <tbody>
                {tournament.seasons.map((season) => {
                  const isSyncing = syncing.has(season.id)
                  const fb = feedback[season.id]
                  return (
                    <tr key={season.id} className="border-b border-border last:border-0 bg-cream hover:bg-cream-dark/30 transition-colors">
                      <td className="px-4 py-3 font-condensed text-sm text-ink">#{season.id}</td>
                      <td className="px-4 py-3 font-condensed text-sm text-text-warm">
                        {season.bold_phase_id ?? <span className="text-vintage-red/70">mangler</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-condensed font-bold text-sm text-ink">
                        {season.match_count.toLocaleString('da-DK')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {fb && (
                            <span className={`font-body text-xs ${fb.ok ? 'text-forest' : 'text-vintage-red'}`}>
                              {fb.text}
                            </span>
                          )}
                          <button
                            onClick={() => syncSeason(season.id)}
                            disabled={isSyncing || syncingAll || season.bold_phase_id == null}
                            className="px-3 py-1.5 bg-forest text-cream font-condensed text-xs uppercase tracking-wide rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity"
                          >
                            {isSyncing ? '...' : 'Sync'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  )
}
