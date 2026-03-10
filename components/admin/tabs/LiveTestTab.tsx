'use client'

import { useState, useEffect, useCallback } from 'react'

type LiveMatch = {
  id: number
  league_id: number
  league_name: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string
  bold_match_id: number | null
  home_bold_team_id: number | null
  away_bold_team_id: number | null
  kickoff_at: string | null
  updated_at: string | null
}

type CoverageRow = {
  league_id: number
  name: string
  total: number
  matched: number
}

type RecentSync = {
  bold_match_id: number | null
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  updated_at: string | null
}

type LiveTestData = {
  liveMatches: LiveMatch[]
  coverage: CoverageRow[]
  recentSyncs: RecentSync[]
  timestamp: string
}

function formatKickoff(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatUpdatedAgo(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `for ${mins} min siden`
  if (hours < 24) return `for ${hours} t siden`
  return d.toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const DEFAULT_TEST_ROUND_ID = 217 // Premier League, 31. runde

export function LiveTestTab() {
  const [data, setData] = useState<LiveTestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveScoresRoundId, setLiveScoresRoundId] = useState(DEFAULT_TEST_ROUND_ID)
  const [liveScoresResult, setLiveScoresResult] = useState<unknown>(null)
  const [liveScoresLoading, setLiveScoresLoading] = useState(false)
  const [liveScoresError, setLiveScoresError] = useState<string | null>(null)

  const testLiveScores = useCallback(async () => {
    setLiveScoresLoading(true)
    setLiveScoresError(null)
    setLiveScoresResult(null)
    try {
      const res = await fetch(`/api/live-scores?round_id=${liveScoresRoundId}`)
      const json = await res.json()
      if (!res.ok) {
        setLiveScoresError(json.error ?? `HTTP ${res.status}`)
      } else {
        setLiveScoresResult(json)
      }
    } catch (err) {
      setLiveScoresError(err instanceof Error ? err.message : 'Kunne ikke hente')
    } finally {
      setLiveScoresLoading(false)
    }
  }, [liveScoresRoundId])

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/admin/live-test')
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="py-8 text-center text-[#7a7060]">
        Henter live data...
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#7a7060]">
            Sidst opdateret: {new Date(d.timestamp).toLocaleString('da-DK', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
          <span className="text-xs text-[#9a9080]">Auto-refresh: 30s</span>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 text-sm font-semibold bg-[#2C4A3E] text-white rounded hover:bg-[#1a3329] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Match table */}
      <div className="border border-black/10 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-dark border-b border-black/10">
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Liga</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Kamp</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Score</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Bold match ID</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Home Bold Team ID</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Away Bold Team ID</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Kickoff</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1a3329]">Sidst opdateret</th>
              </tr>
            </thead>
            <tbody>
              {d.liveMatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#7a7060]">
                    Ingen live eller halvleg-kampe lige nu
                  </td>
                </tr>
              ) : (
                d.liveMatches.map((m) => (
                  <tr key={m.id} className="border-b border-black/5 hover:bg-cream/50">
                    <td className="px-4 py-3">{m.league_name}</td>
                    <td className="px-4 py-3">{m.home_team} — {m.away_team}</td>
                    <td className="px-4 py-3">
                      {m.home_score ?? '—'} - {m.away_score ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          m.status === 'live'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{m.bold_match_id ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.home_bold_team_id ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.away_bold_team_id ?? '—'}</td>
                    <td className="px-4 py-3">{formatKickoff(m.kickoff_at)}</td>
                    <td className="px-4 py-3 text-[#7a7060]">{formatUpdatedAgo(m.updated_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-black/10 rounded-lg bg-white p-4">
          <h3 className="font-semibold text-[#1a3329] mb-3">Bold Teams Coverage</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10">
                  <th className="text-left py-2 font-medium">Liga</th>
                  <th className="text-right py-2 font-medium">Matchede</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.coverage.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-[#7a7060]">
                      Ingen data
                    </td>
                  </tr>
                ) : (
                  d.coverage.map((c) => (
                    <tr key={c.league_id} className="border-b border-black/5">
                      <td className="py-2">{c.name}</td>
                      <td className="text-right py-2 font-mono">{c.matched}</td>
                      <td className="text-right py-2 font-mono">{c.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-black/10 rounded-lg bg-white p-4">
          <h3 className="font-semibold text-[#1a3329] mb-3">Test live scores API</h3>
          <p className="text-xs text-[#7a7060] mb-3">
            Kalder GET /api/live-scores?round_id=X
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-sm">Round ID:</label>
            <input
              type="number"
              value={liveScoresRoundId}
              onChange={(e) => setLiveScoresRoundId(parseInt(e.target.value, 10) || DEFAULT_TEST_ROUND_ID)}
              className="w-20 px-2 py-1 border border-black/15 rounded text-sm font-mono"
            />
            <button
              type="button"
              onClick={testLiveScores}
              disabled={liveScoresLoading}
              className="px-3 py-1.5 text-sm font-medium bg-[#2C4A3E] text-white rounded hover:bg-[#1a3329] disabled:opacity-50 transition-colors"
            >
              {liveScoresLoading ? 'Henter...' : 'Test live scores for aktuel runde'}
            </button>
          </div>
          {liveScoresError && (
            <p className="text-sm text-red-600 mb-2">{liveScoresError}</p>
          )}
          {liveScoresResult != null && (
            <pre className="text-xs bg-[#f5f0e8] p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(liveScoresResult, null, 2)}
            </pre>
          )}
        </div>

        <div className="border border-black/10 rounded-lg bg-white p-4">
          <h3 className="font-semibold text-[#1a3329] mb-3">Seneste Bold sync</h3>
          <p className="text-xs text-[#7a7060] mb-3">Sidste time, max 5 kampe</p>
          <div className="space-y-2">
            {d.recentSyncs.length === 0 ? (
              <p className="text-sm text-[#7a7060]">Ingen opdateringer</p>
            ) : (
              d.recentSyncs.map((r, i) => (
                <div key={i} className="text-sm border-b border-black/5 pb-2 last:border-0">
                  <span className="font-mono text-xs text-[#7a7060]">{r.bold_match_id ?? '—'}</span>
                  <span className="mx-2">·</span>
                  <span>{r.home_team} – {r.away_team}</span>
                  <span className="mx-2">
                    {r.home_score ?? '?'} - {r.away_score ?? '?'}
                  </span>
                  <span className="text-[#7a7060] text-xs ml-2">
                    {formatUpdatedAgo(r.updated_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
