'use client'

import { useState, useEffect, useCallback } from 'react'

type KoMatch = {
  id: number
  round_id: number | null
  kickoff: string | null
  status: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  is_on_fire: boolean
  ko_method: string | null
  ko_advanced: string | null
  ko_resolved: boolean
  round_name: string
}

type Method = 'reg' | 'et' | 'pen'
type Draft = { method: Method; advanced: '1' | '2' }

const METHOD_LABEL: Record<Method, string> = {
  reg: 'Ordinær tid',
  et: 'Forlænget',
  pen: 'Straffe',
}

/**
 * Smart standard pr. kamp: afgjort i ordinær tid, og "hvem videre" = holdet med
 * højeste score. Det passer for ordinær (vinderen), forlænget (vindermålet) OG
 * straffe (Bold lægger straffescoren i resultatet, så straffevinderen har den
 * højeste score). Admin behøver derfor kun ændre METODEN på ikke-ordinære kampe.
 */
function defaultDraft(m: KoMatch): Draft {
  const advanced: '1' | '2' = (m.home_score ?? 0) >= (m.away_score ?? 0) ? '1' : '2'
  return { method: 'reg', advanced }
}

function fmtKickoff(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('da-DK', {
    timeZone: 'Europe/Copenhagen',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function AdminKnockoutTab() {
  const [matches, setMatches] = useState<KoMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/knockout')
      .then((r) => r.json())
      .then((d) => setMatches(d.matches ?? []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const setDraft = (m: KoMatch, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [m.id]: { ...defaultDraft(m), ...prev[m.id], ...patch } }))

  async function resolve(m: KoMatch) {
    const d = drafts[m.id] ?? defaultDraft(m)
    setSavingId(m.id)
    setMsg(null)
    const res = await fetch('/api/admin/knockout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: m.id, method: d.method, advanced: d.advanced }),
    })
    const data = await res.json()
    setSavingId(null)
    if (!res.ok) { setMsg(data.error ?? 'Fejl'); return }
    setMsg(`${m.home_team}–${m.away_team} afgjort ✓`)
    load()
  }

  const finished = matches.filter((m) => m.status === 'finished')
  const unresolved = finished.filter((m) => !m.ko_resolved)
  const upcoming = matches.filter((m) => m.status !== 'finished')

  return (
    <div className="space-y-6">
      <div className="border border-warm-border bg-cream-dark/40 p-4" style={{ borderRadius: '2px' }}>
        <p className="font-body text-[13px] text-ink leading-relaxed">
          Bold giver ikke FT/AET/Pen-koden, og slutresultatet inkluderer forlænget tid — så
          knockout-kampe <strong>afgøres manuelt her</strong>. Indtil en kamp er afgjort står
          dens knockout-bets <strong>pending</strong> (intet fejl-scores). Når du afgør, scores
          rundens bets straks.
        </p>
      </div>

      {msg && (
        <div className="border border-forest bg-forest/5 px-4 py-2 font-body text-[13px] text-forest" style={{ borderRadius: '2px' }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="border border-warm-border bg-cream p-12 text-center font-body text-warm-gray" style={{ borderRadius: '2px' }}>
          Henter knockout-kampe...
        </div>
      ) : (
        <>
          {/* Afgjorte kampe der mangler afgørelse */}
          <section>
            <h3 className="font-condensed text-[12px] font-bold uppercase tracking-wide text-ink mb-2">
              Mangler afgørelse ({unresolved.length})
            </h3>
            {unresolved.length === 0 ? (
              <p className="font-body text-[13px] text-warm-gray">Ingen spillede knockout-kampe venter.</p>
            ) : (
              <div className="space-y-2">
                {unresolved.map((m) => {
                  const d = drafts[m.id] ?? defaultDraft(m)
                  return (
                    <div key={m.id} className="border border-warm-border bg-cream p-3" style={{ borderRadius: '2px' }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <span className="font-condensed text-[10px] font-bold uppercase text-warm-gray">{m.round_name}</span>
                          {m.is_on_fire && <span className="ml-2 text-[11px] font-bold text-gold">🔥 on fire</span>}
                          <p className="font-condensed text-[15px] font-bold text-ink">
                            {m.home_team} <span className="text-warm-gray">{m.home_score}–{m.away_score}</span> {m.away_team}
                          </p>
                        </div>
                        <span className="font-body text-[11px] text-warm-gray">{fmtKickoff(m.kickoff)}</span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="font-condensed text-[10px] font-bold uppercase text-warm-gray mr-1">Afgjort</span>
                          {(['reg', 'et', 'pen'] as Method[]).map((mt) => (
                            <button
                              key={mt}
                              type="button"
                              onClick={() => setDraft(m, { method: mt })}
                              className={`font-condensed text-[11px] font-bold px-2.5 py-1 border transition-colors ${
                                d.method === mt ? 'bg-forest text-cream border-forest' : 'bg-cream text-warm-gray border-warm-border hover:border-forest'
                              }`}
                              style={{ borderRadius: '2px' }}
                            >
                              {METHOD_LABEL[mt]}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-condensed text-[10px] font-bold uppercase text-warm-gray mr-1">Videre</span>
                          {([['1', m.home_team], ['2', m.away_team]] as const).map(([v, name]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setDraft(m, { advanced: v })}
                              className={`font-condensed text-[11px] font-bold px-2.5 py-1 border transition-colors max-w-[140px] truncate ${
                                d.advanced === v ? 'bg-forest text-cream border-forest' : 'bg-cream text-warm-gray border-warm-border hover:border-forest'
                              }`}
                              style={{ borderRadius: '2px' }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={savingId === m.id}
                          onClick={() => resolve(m)}
                          className="font-condensed text-[11px] font-bold uppercase px-3 py-1.5 bg-gold text-forest disabled:opacity-50"
                          style={{ borderRadius: '2px' }}
                        >
                          {savingId === m.id ? 'Gemmer...' : 'Afgør'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Allerede afgjorte */}
          <section>
            <h3 className="font-condensed text-[12px] font-bold uppercase tracking-wide text-ink mb-2">
              Afgjorte ({finished.filter((m) => m.ko_resolved).length})
            </h3>
            <div className="space-y-1.5">
              {finished.filter((m) => m.ko_resolved).map((m) => (
                <div key={m.id} className="border border-warm-border bg-cream-dark/30 px-3 py-2 flex items-center justify-between gap-2 flex-wrap" style={{ borderRadius: '2px' }}>
                  <span className="font-condensed text-[13px] font-bold text-ink">
                    {m.home_team} {m.home_score}–{m.away_score} {m.away_team}
                    {m.is_on_fire && <span className="ml-2 text-gold">🔥</span>}
                  </span>
                  <span className="font-body text-[11px] text-warm-gray">
                    {m.ko_method == null ? 'Ordinær tid' : m.ko_method === 'et' ? 'Forlænget' : 'Straffe'}
                    {' · videre: '}
                    {m.ko_advanced === '1' ? m.home_team : m.away_team}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Kommende */}
          {upcoming.length > 0 && (
            <section>
              <h3 className="font-condensed text-[12px] font-bold uppercase tracking-wide text-warm-gray mb-2">
                Kommende ({upcoming.length})
              </h3>
              <div className="space-y-1">
                {upcoming.map((m) => (
                  <div key={m.id} className="px-3 py-1.5 font-body text-[12px] text-warm-gray flex items-center justify-between gap-2">
                    <span>{m.round_name}: {m.home_team} – {m.away_team} {m.is_on_fire && <span className="text-gold">🔥</span>}</span>
                    <span className="text-[11px]">{fmtKickoff(m.kickoff)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
