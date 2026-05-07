'use client'

import React, { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/dateUtils'

type Props = Record<string, never>
type Race = {
  id: string
  name: string
  pcs_slug: string
  race_type: string
  profile: string
  start_date: string | null
  year: number
  status: string | null
  results_uploaded_at: string | null
  startlist_count: number
  startlist_total: number | null
}

type StartlistRider = {
  bib_number: number | null
  first_name: string
  last_name: string
  team_name: string
  category: number
}

type Stage = {
  id: string
  stage_number: number
  name: string | null
  profile: string | null
  start_date: string | null
  results_uploaded_at: string | null
  distance_km: number | null
  departure: string | null
  arrival: string | null
  profile_score: number | null
  vertical_meters: number | null
  won_how: string | null
}

function RaceStatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'upcoming'
  const colors: Record<string, string> = {
    upcoming: 'text-gold bg-gold/10 border-gold/30',
    active: 'text-forest bg-forest/10 border-forest/30',
    finished: 'text-warm-gray bg-cream-dark border-warm-border',
  }
  return (
    <span
      className={`font-condensed text-xs uppercase tracking-wide border px-2 py-0.5 ${colors[s] ?? colors.upcoming}`}
      style={{ borderRadius: '2px' }}
    >
      {s}
    </span>
  )
}

function InfoDot({ has }: { has: boolean }) {
  return has
    ? <span className="w-1.5 h-1.5 rounded-full bg-forest shrink-0 inline-block" />
    : <span className="w-1.5 h-1.5 rounded-full bg-vintage-red/40 shrink-0 inline-block" />
}

export function AdminCyclingRacesTab() {
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState<Set<string>>(new Set())
  const [expandedRace, setExpandedRace] = useState<string | null>(null)
  const [stagesCache, setStagesCache] = useState<Record<string, Stage[]>>({})
  const [stagesLoading, setStagesLoading] = useState<Set<string>>(new Set())
  const [startlistModal, setStartlistModal] = useState<{ raceId: string; raceName: string } | null>(null)
  const [startlistRiders, setStartlistRiders] = useState<StartlistRider[]>([])
  const [startlistLoading, setStartlistLoading] = useState(false)

  const authHeader = {
    'Content-Type': 'application/json',
      }

  useEffect(() => {
    fetch('/api/admin/cycling/overview', { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (data.races) setRaces(data.races)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateRaceStatus(raceId: string, newStatus: string) {
    setStatusUpdating((s) => new Set(s).add(raceId))
    try {
      const res = await fetch('/api/admin/cycling/races', {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ id: raceId, status: newStatus }),
      })
      if (res.ok) {
        setRaces((prev) => prev.map((r) => (r.id === raceId ? { ...r, status: newStatus } : r)))
      }
    } catch { /* */ }
    finally {
      setStatusUpdating((s) => { const n = new Set(s); n.delete(raceId); return n })
    }
  }

  async function toggleStages(raceId: string) {
    if (expandedRace === raceId) { setExpandedRace(null); return }
    setExpandedRace(raceId)
    if (stagesCache[raceId]) return

    setStagesLoading((s) => new Set(s).add(raceId))
    try {
      const res = await fetch(`/api/admin/cycling/races/${raceId}/stages`, { headers: authHeader })
      const data = await res.json()
      setStagesCache((prev) => ({ ...prev, [raceId]: data.stages ?? [] }))
    } catch {
      setStagesCache((prev) => ({ ...prev, [raceId]: [] }))
    } finally {
      setStagesLoading((s) => { const n = new Set(s); n.delete(raceId); return n })
    }
  }

  async function openStartlistModal(raceId: string, raceName: string) {
    setStartlistModal({ raceId, raceName })
    setStartlistRiders([])
    setStartlistLoading(true)
    try {
      const res = await fetch(`/api/admin/cycling/races/${raceId}/startlist`, { headers: authHeader })
      const data = await res.json()
      setStartlistRiders(data.riders ?? [])
    } catch {
      setStartlistRiders([])
    } finally {
      setStartlistLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="border border-warm-border bg-cream p-8 text-center" style={{ borderRadius: '2px' }}>
        <p className="font-condensed text-[13px] text-warm-gray uppercase tracking-wide">Henter l\u00f8b...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Race table ───────────────────────────────────────────── */}
      {races.length === 0 ? (
        <p className="font-body text-[13px] text-warm-gray">Ingen l\u00f8b registreret endnu.</p>
      ) : (
        <div className="border border-warm-border bg-cream overflow-hidden" style={{ borderRadius: '2px' }}>
          <div className="overflow-x-auto">
            <table className="w-full font-body text-[13px]">
              <thead>
                <tr className="font-condensed text-[10px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border">
                  <th className="text-left px-3 py-2">L\u00f8b</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Profil</th>
                  <th className="text-left px-3 py-2">Dato</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Startliste</th>
                  <th className="text-left px-3 py-2">Resultater</th>
                </tr>
              </thead>
              <tbody>
                {races.map((race) => {
                  const isStageRace = race.race_type === 'stage_race'
                  const isExpanded = expandedRace === race.id
                  const stages = stagesCache[race.id]
                  const isLoadingStages = stagesLoading.has(race.id)

                  return (
                    <React.Fragment key={race.id}>
                      <tr className="border-b border-warm-border">
                        <td className="px-3 py-2.5 font-medium text-ink">
                          <div className="flex items-center gap-2">
                            {isStageRace ? (
                              <button onClick={() => toggleStages(race.id)} className="text-warm-gray hover:text-ink transition-colors shrink-0 w-4 text-center">
                                {isExpanded ? '\u25BC' : '\u25B6'}
                              </button>
                            ) : <span className="w-4" />}
                            {race.name}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-warm-gray">{isStageRace ? 'Etapel\u00f8b' : 'Endagsl\u00f8b'}</td>
                        <td className="px-3 py-2.5 text-warm-gray capitalize">{race.profile}</td>
                        <td className="px-3 py-2.5 text-warm-gray">{race.start_date ?? '\u2014'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <select
                            value={race.status ?? 'upcoming'}
                            onChange={(e) => updateRaceStatus(race.id, e.target.value)}
                            disabled={statusUpdating.has(race.id)}
                            className="font-condensed text-[11px] uppercase tracking-wide bg-cream border border-warm-border px-2 py-1 text-ink disabled:opacity-50"
                            style={{ borderRadius: '2px' }}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="active">Active</option>
                            <option value="finished">Finished</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-[12px]">
                          {race.startlist_count > 0 ? (
                            <button onClick={() => openStartlistModal(race.id, race.name)} className="inline-flex items-center gap-1.5 hover:underline">
                              <span className="w-1.5 h-1.5 rounded-full bg-forest shrink-0" />
                              <span className="text-ink">{race.startlist_count}{race.startlist_total ? ` / ${race.startlist_total}` : ''} bekr\u00e6ftede</span>
                            </button>
                          ) : <span className="text-warm-gray">\u2014</span>}
                        </td>
                        <td className="px-3 py-2.5 text-warm-gray text-[12px]">
                          {race.results_uploaded_at ? formatDateTime(race.results_uploaded_at) : '\u2014'}
                        </td>
                      </tr>
                      {isStageRace && isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <div className="bg-cream-dark border-b border-warm-border">
                              {isLoadingStages ? (
                                <p className="px-8 py-3 font-condensed text-[11px] text-warm-gray uppercase tracking-wide">Henter etaper...</p>
                              ) : !stages || stages.length === 0 ? (
                                <p className="px-8 py-3 font-body text-[12px] text-warm-gray">Ingen etaper registreret.</p>
                              ) : (
                                <table className="w-full font-body text-[12px]">
                                  <thead>
                                    <tr className="font-condensed text-[9px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border">
                                      <th className="text-left px-8 py-1.5">Etape</th>
                                      <th className="text-left px-3 py-1.5">Rute</th>
                                      <th className="text-left px-3 py-1.5">Profil</th>
                                      <th className="text-right px-3 py-1.5">Km</th>
                                      <th className="text-right px-3 py-1.5">H\u00f8jde</th>
                                      <th className="text-right px-3 py-1.5">PS</th>
                                      <th className="text-left px-3 py-1.5">Dato</th>
                                      <th className="text-left px-3 py-1.5">Won how</th>
                                      <th className="text-center px-3 py-1.5">Info</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stages.map((stage) => (
                                      <tr key={stage.id} className="border-b border-warm-border/50">
                                        <td className="px-8 py-1.5 text-ink font-medium">
                                          {stage.stage_number === 0 ? 'Prolog' : `Etape ${stage.stage_number}`}
                                        </td>
                                        <td className="px-3 py-1.5 text-warm-gray">
                                          {stage.departure && stage.arrival
                                            ? `${stage.departure} \u2192 ${stage.arrival}`
                                            : stage.name ?? '\u2014'}
                                        </td>
                                        <td className="px-3 py-1.5 text-warm-gray capitalize">{stage.profile ?? '\u2014'}</td>
                                        <td className="px-3 py-1.5 text-warm-gray text-right">{stage.distance_km ?? '\u2014'}</td>
                                        <td className="px-3 py-1.5 text-warm-gray text-right">
                                          {stage.vertical_meters ? `${stage.vertical_meters.toLocaleString()} m` : '\u2014'}
                                        </td>
                                        <td className="px-3 py-1.5 text-warm-gray text-right">{stage.profile_score ?? '\u2014'}</td>
                                        <td className="px-3 py-1.5 text-warm-gray">{stage.start_date ?? '\u2014'}</td>
                                        <td className="px-3 py-1.5 text-warm-gray text-[11px]">{stage.won_how ?? '\u2014'}</td>
                                        <td className="px-3 py-1.5 text-center">
                                          <InfoDot has={!!(stage.distance_km && stage.departure)} />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Startlist modal ──────────────────────────────────────── */}
      {startlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setStartlistModal(null)}>
          <div
            className="bg-cream border border-warm-border w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            style={{ borderRadius: '2px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-warm-border flex items-center justify-between">
              <div>
                <p className="font-condensed uppercase text-warm-gray" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Startliste</p>
                <h3 className="font-condensed font-bold text-ink text-base uppercase tracking-wide">{startlistModal.raceName}</h3>
              </div>
              <button onClick={() => setStartlistModal(null)} className="font-condensed text-[12px] text-warm-gray hover:text-ink px-3 py-1 border border-warm-border hover:bg-cream-dark" style={{ borderRadius: '2px' }}>Luk</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {startlistLoading ? (
                <p className="px-5 py-8 text-center font-condensed text-[13px] text-warm-gray uppercase tracking-wide">Henter startliste...</p>
              ) : startlistRiders.length === 0 ? (
                <p className="px-5 py-8 text-center font-body text-[13px] text-warm-gray">Ingen ryttere fundet.</p>
              ) : (
                <table className="w-full font-body text-[13px]">
                  <thead>
                    <tr className="font-condensed text-[10px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border sticky top-0 bg-cream">
                      <th className="text-left px-5 py-2">Nr</th>
                      <th className="text-left px-3 py-2">Navn</th>
                      <th className="text-left px-3 py-2">Hold</th>
                      <th className="text-center px-3 py-2">Kat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {startlistRiders.map((rider, i) => (
                      <tr key={i} className="border-b border-warm-border">
                        <td className="px-5 py-2 text-warm-gray">{rider.bib_number ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-ink font-medium">{rider.last_name} {rider.first_name}</td>
                        <td className="px-3 py-2 text-warm-gray">{rider.team_name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="font-condensed text-[10px] font-bold uppercase border px-1.5 py-0.5 text-warm-gray border-warm-border" style={{ borderRadius: '2px' }}>{rider.category}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
