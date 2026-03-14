'use client'

import { useState } from 'react'
import Link from 'next/link'

type League = { id: number; name: string; bold_phase_id: number | null }

type Props = { leagues: League[] }

export default function SyncTesterClient({ leagues }: Props) {
  const [mode, setMode] = useState<'match' | 'scores' | 'fixtures' | 'phase_info'>('match')
  const [boldMatchId, setBoldMatchId] = useState('')
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? '')
  const [boldPhaseId, setBoldPhaseId] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)

  async function run(opts?: { m?: typeof mode; boldMatchId?: string; leagueId?: string | number; boldPhaseId?: string; dryRun?: boolean }) {
    const m = opts?.m ?? mode
    const bmId = opts?.boldMatchId ?? boldMatchId
    const lid = opts?.leagueId ?? leagueId
    const phaseId = opts?.boldPhaseId ?? boldPhaseId
    const dr = opts?.dryRun ?? dryRun

    setMode(m)
    setLoading(true)
    setResult(null)
    setElapsed(null)

    const body: Record<string, unknown> = {
      mode: m,
      dry_run: dr,
    }
    if (m === 'match' && bmId) body.bold_match_id = parseInt(bmId, 10)
    if (m === 'fixtures' && lid) body.season_id = parseInt(String(lid), 10)
    if (m === 'phase_info' && phaseId) body.bold_phase_id = parseInt(phaseId, 10)

    try {
      const res = await fetch('/api/admin/sync-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResult(data)
      setElapsed(data.elapsed_ms ?? null)
      if (!res.ok) setResult((prev) => ({ ...prev, error: data.error }))
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  const hasPreview = result && ('preview' in result) && Array.isArray(result.preview)
  const hasPhaseInfo = result && result.mode === 'phase_info' && 'rounds' in result

  return (
    <div className="space-y-8">
      <Link href="/admin" className="text-[#7a7060] hover:text-[#1a3329] text-sm font-condensed">
        &larr; Tilbage til admin
      </Link>

      {/* 1. Test enkelt kamp */}
      <section className="bg-white border border-[#C8BEA8] rounded-lg p-5">
        <h2 className="font-condensed font-bold text-[#1a3329] text-lg mb-3">1. Test enkelt kamp</h2>
        <p className="text-sm text-[#7a7060] mb-4">
          Hent raw JSON fra Bold API for en specifik kamp (match_ids).
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-condensed uppercase text-[#7a7060] mb-1">
              bold_match_id
            </label>
            <input
              type="number"
              value={boldMatchId}
              onChange={(e) => setBoldMatchId(e.target.value)}
              placeholder="fx 123456"
              className="border border-[#C8BEA8] rounded px-3 py-2 w-32 font-body text-sm"
            />
          </div>
          <button
            onClick={() => run({ m: 'match', boldMatchId })}
            disabled={loading || !boldMatchId}
            className="px-4 py-2 bg-[#2C4A3E] text-[#F2EDE4] font-condensed text-sm rounded hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Henter...' : 'Hent fra Bold'}
          </button>
        </div>
      </section>

      {/* 2. Test aktiv runde */}
      <section className="bg-white border border-[#C8BEA8] rounded-lg p-5">
        <h2 className="font-condensed font-bold text-[#1a3329] text-lg mb-3">2. Test aktiv runde</h2>
        <p className="text-sm text-[#7a7060] mb-4">
          Sync scores for kampe der er kicket off indenfor de seneste 3 timer. Valgfrit: kun én kamp via bold_match_id.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-condensed uppercase text-[#7a7060] mb-1">
              bold_match_id (valgfri)
            </label>
            <input
              type="number"
              value={boldMatchId}
              onChange={(e) => setBoldMatchId(e.target.value)}
              placeholder="Kun én kamp"
              className="border border-[#C8BEA8] rounded px-3 py-2 w-32 font-body text-sm"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-[#7a7060]">Dry-run (skriv ikke til DB)</span>
          </label>
          <button
            onClick={() => run({ m: 'scores', boldMatchId: boldMatchId || undefined, dryRun })}
            disabled={loading}
            className="px-4 py-2 bg-[#2C4A3E] text-[#F2EDE4] font-condensed text-sm rounded hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Kører...' : 'Sync scores'}
          </button>
        </div>
      </section>

      {/* 3. Dry-run sync */}
      <section className="bg-white border border-[#C8BEA8] rounded-lg p-5">
        <h2 className="font-condensed font-bold text-[#1a3329] text-lg mb-3">3. Dry-run sync (fixtures)</h2>
        <p className="text-sm text-[#7a7060] mb-4">
          Hent fixtures fra Bold API for en liga. Uden dry-run skrives til league_matches.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-condensed uppercase text-[#7a7060] mb-1">
              Liga
            </label>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="border border-[#C8BEA8] rounded px-3 py-2 min-w-[200px] font-body text-sm"
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-[#7a7060]">Dry-run (skriv ikke til DB)</span>
          </label>
          <button
            onClick={() => run({ m: 'fixtures', leagueId, dryRun })}
            disabled={loading}
            className="px-4 py-2 bg-[#2C4A3E] text-[#F2EDE4] font-condensed text-sm rounded hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Kører...' : 'Sync fixtures'}
          </button>
        </div>
      </section>

      {/* 4. Sæson info (phase_id) */}
      <section className="bg-white border border-[#C8BEA8] rounded-lg p-5">
        <h2 className="font-condensed font-bold text-[#1a3329] text-lg mb-3">4. Sæson info (phase_id)</h2>
        <p className="text-sm text-[#7a7060] mb-4">
          Hent oversigt over sæsonen fra Bold API: første/sidste kampdata, antal kampe, runder med datoer.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-condensed uppercase text-[#7a7060] mb-1">
              bold_phase_id
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={boldPhaseId}
                onChange={(e) => setBoldPhaseId(e.target.value)}
                placeholder="fx 23535"
                className="border border-[#C8BEA8] rounded px-3 py-2 w-32 font-body text-sm"
              />
              <span className="text-[#7a7060] text-xs">eller</span>
              <select
                onChange={(e) => {
                  const l = leagues.find((x) => String(x.id) === e.target.value)
                  if (l?.bold_phase_id) setBoldPhaseId(String(l.bold_phase_id))
                }}
                className="border border-[#C8BEA8] rounded px-3 py-2 min-w-[160px] font-body text-sm"
              >
                <option value="">Vælg liga...</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.bold_phase_id})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => run({ m: 'phase_info', boldPhaseId })}
            disabled={loading || !boldPhaseId}
            className="px-4 py-2 bg-[#2C4A3E] text-[#F2EDE4] font-condensed text-sm rounded hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Henter...' : 'Hent sæson info'}
          </button>
        </div>
      </section>

      {/* Resultat */}
      {result && (
        <section className="bg-white border border-[#C8BEA8] rounded-lg p-5">
          <h2 className="font-condensed font-bold text-[#1a3329] text-lg mb-3">Resultat</h2>
          {elapsed != null && (
            <p className="text-sm text-[#7a7060] mb-3 font-body">
              ⏱️ Elapsed: <strong>{elapsed} ms</strong>
            </p>
          )}

          {hasPhaseInfo && (
            <div className="mb-4 p-4 bg-[#2C4A3E]/10 border-2 border-[#2C4A3E]/30 rounded-lg">
              <p className="font-condensed font-bold text-[#1a3329] text-sm mb-3 uppercase tracking-wide">
                Sæson info
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 font-body text-sm">
                <div>
                  <span className="text-[#7a7060] block text-xs">Første kamp</span>
                  <span className="font-semibold text-[#1a3329]">
                    {result.first_match_date
                      ? new Date(result.first_match_date as string).toLocaleDateString('da-DK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#7a7060] block text-xs">Sidste kamp</span>
                  <span className="font-semibold text-[#1a3329]">
                    {result.last_match_date
                      ? new Date(result.last_match_date as string).toLocaleDateString('da-DK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#7a7060] block text-xs">Antal kampe</span>
                  <span className="font-semibold text-[#1a3329]">{String(result.total_matches ?? 0)}</span>
                </div>
              </div>
              {Array.isArray(result.rounds) && result.rounds.length > 0 && (
                <div>
                  <p className="text-xs font-condensed uppercase text-[#7a7060] mb-2">Runder</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(result.rounds as Array<{ name: string; match_count: number; first_kickoff: string | null; last_kickoff: string | null }>).map((r) => (
                      <div
                        key={r.name}
                        className="flex justify-between items-center text-xs font-body py-1 border-b border-[#C8BEA8]/30 last:border-0"
                      >
                        <span className="font-semibold text-[#1a3329]">{r.name}</span>
                        <span className="text-[#7a7060]">
                          {r.match_count} kampe
                          {r.first_kickoff && r.last_kickoff && (
                            <> · {new Date(r.first_kickoff).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })} – {new Date(r.last_kickoff).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {hasPreview && (
            <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
              <p className="font-condensed font-bold text-amber-800 text-sm mb-2 uppercase tracking-wide">
                ⚠️ VILLE blive skrevet til DB (dry-run preview)
              </p>
              <pre className="text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono text-amber-900 bg-white p-3 rounded border border-amber-200">
                {JSON.stringify(result.preview, null, 2)}
              </pre>
            </div>
          )}

          {result.raw_bold_response && (
            <div className="mb-4">
              <p className="font-condensed font-bold text-[#7a7060] text-sm mb-2 uppercase tracking-wide">
                Raw Bold API response
              </p>
              <pre className="text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono text-[#1a3329] bg-[#F2EDE4] p-3 rounded border border-[#C8BEA8]">
                {JSON.stringify(result.raw_bold_response, null, 2)}
              </pre>
            </div>
          )}

          <p className="font-condensed text-xs font-bold text-[#7a7060] uppercase tracking-wide mb-1">
            Full JSON
          </p>
          <pre className="text-xs overflow-x-auto max-h-96 overflow-y-auto font-mono text-[#1a3329] bg-[#F2EDE4] p-3 rounded border border-[#C8BEA8]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </div>
  )
}
