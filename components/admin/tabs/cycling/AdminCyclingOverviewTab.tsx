'use client'

import React, { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/dateUtils'

type Props = {
  adminSecret: string
}

type RiderStats = {
  total: number
  byCategory: Record<number, number>
  lastSynced: string | null
}

type Race = {
  id: number
  name: string
  pcs_slug: string
  race_type: string
  profile: string
  start_date: string | null
  year: number
  status: string | null
  results_uploaded_at: string | null
}

type Stage = {
  id: number
  stage_number: number
  name: string | null
  profile: string | null
  start_date: string | null
  results_uploaded_at: string | null
}

type SyncLog = {
  id: number
  created_at: string
  sync_type: string
  records_affected: number | null
  status: string
  message: string | null
}

function StatusDot({ status }: { status: string }) {
  if (status === 'success')
    return <span className="w-2 h-2 rounded-full bg-forest shrink-0" />
  if (status === 'error')
    return (
      <span className="w-2 h-2 rounded-full bg-vintage-red animate-pulse shrink-0" />
    )
  return <span className="w-2 h-2 rounded-full bg-warm-gray shrink-0" />
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

export function AdminCyclingOverviewTab({ adminSecret }: Props) {
  const [riderStats, setRiderStats] = useState<RiderStats | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncMsg, setSyncMsg] = useState<{
    type: 'ok' | 'err'
    text: string
  } | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<Set<number>>(new Set())
  const [expandedRace, setExpandedRace] = useState<number | null>(null)
  const [stagesCache, setStagesCache] = useState<Record<number, Stage[]>>({})
  const [stagesLoading, setStagesLoading] = useState<Set<number>>(new Set())

  const authHeader = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminSecret}`,
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/cycling/overview', { headers: authHeader }).then((r) =>
        r.json(),
      ),
    ])
      .then(([data]) => {
        if (data.riders) setRiderStats(data.riders)
        if (data.races) setRaces(data.races)
        if (data.syncLogs) setSyncLogs(data.syncLogs)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSync() {
    setSyncLoading(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/cycling/sync-riders', {
        method: 'POST',
        headers: authHeader,
      })
      const data = await res.json()
      setSyncMsg({ type: 'ok', text: data.message ?? 'Sync besked sendt' })
    } catch {
      setSyncMsg({ type: 'err', text: 'Netværksfejl' })
    } finally {
      setSyncLoading(false)
      setTimeout(() => setSyncMsg(null), 5000)
    }
  }

  async function updateRaceStatus(raceId: number, newStatus: string) {
    setStatusUpdating((s) => new Set(s).add(raceId))
    try {
      const res = await fetch('/api/admin/cycling/races', {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ id: raceId, status: newStatus }),
      })
      if (res.ok) {
        setRaces((prev) =>
          prev.map((r) => (r.id === raceId ? { ...r, status: newStatus } : r)),
        )
      }
    } catch {
      /* ignore */
    } finally {
      setStatusUpdating((s) => {
        const n = new Set(s)
        n.delete(raceId)
        return n
      })
    }
  }

  async function toggleStages(raceId: number) {
    if (expandedRace === raceId) {
      setExpandedRace(null)
      return
    }
    setExpandedRace(raceId)
    if (stagesCache[raceId]) return

    setStagesLoading((s) => new Set(s).add(raceId))
    try {
      const res = await fetch(`/api/admin/cycling/races/${raceId}/stages`, {
        headers: authHeader,
      })
      const data = await res.json()
      setStagesCache((prev) => ({ ...prev, [raceId]: data.stages ?? [] }))
    } catch {
      setStagesCache((prev) => ({ ...prev, [raceId]: [] }))
    } finally {
      setStagesLoading((s) => {
        const n = new Set(s)
        n.delete(raceId)
        return n
      })
    }
  }

  if (loading) {
    return (
      <div
        className="border border-warm-border bg-cream p-8 text-center"
        style={{ borderRadius: '2px' }}
      >
        <p className="font-condensed text-[13px] text-warm-gray uppercase tracking-wide">
          Henter cykling-data...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Ryttere ───────────────────────────────────────────────── */}
      <div
        className="border border-warm-border bg-cream p-5"
        style={{ borderRadius: '2px' }}
      >
        <p
          className="font-condensed uppercase text-warm-gray mb-0.5"
          style={{ fontSize: '11px', letterSpacing: '0.1em' }}
        >
          Data
        </p>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">
          Ryttere
        </h2>

        {riderStats ? (
          <>
            <div className="flex items-center gap-6 mb-4">
              <div>
                <span className="font-condensed text-[11px] uppercase text-warm-gray tracking-wide">
                  Total
                </span>
                <p className="font-condensed font-bold text-ink text-2xl">
                  {riderStats.total}
                </p>
              </div>
              <div>
                <span className="font-condensed text-[11px] uppercase text-warm-gray tracking-wide">
                  Sidst synkroniseret
                </span>
                <p className="font-body text-[13px] text-ink">
                  {riderStats.lastSynced
                    ? formatDateTime(riderStats.lastSynced)
                    : 'Aldrig'}
                </p>
              </div>
            </div>

            <table className="w-full font-body text-[13px] mb-4">
              <thead>
                <tr className="font-condensed text-[10px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border">
                  <th className="text-left px-3 py-2">Kategori</th>
                  <th className="text-right px-3 py-2">Antal</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((cat) => (
                  <tr key={cat} className="border-b border-warm-border">
                    <td className="px-3 py-2 text-ink">Kategori {cat}</td>
                    <td className="px-3 py-2 text-right text-ink font-medium">
                      {riderStats.byCategory[cat] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="font-body text-[13px] text-warm-gray">
            Ingen ryttere synkroniseret endnu.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncLoading}
            className="inline-flex items-center gap-1.5 font-condensed text-[12px] font-semibold text-forest px-4 py-2 border border-warm-border hover:bg-cream-dark disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '2px' }}
          >
            {syncLoading ? 'Synkroniserer...' : 'Synkroniser ryttere'}
          </button>
          {syncMsg && (
            <span
              className={`font-body text-[12px] ${syncMsg.type === 'ok' ? 'text-forest' : 'text-vintage-red'}`}
            >
              {syncMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* ── Løb ──────────────────────────────────────────────────── */}
      <div
        className="border border-warm-border bg-cream p-5"
        style={{ borderRadius: '2px' }}
      >
        <p
          className="font-condensed uppercase text-warm-gray mb-0.5"
          style={{ fontSize: '11px', letterSpacing: '0.1em' }}
        >
          Sæson 2026
        </p>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">
          Løb
        </h2>

        {races.length === 0 ? (
          <p className="font-body text-[13px] text-warm-gray">
            Ingen løb registreret endnu.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body text-[13px]">
              <thead>
                <tr className="font-condensed text-[10px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border">
                  <th className="text-left px-3 py-2">Løb</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Profil</th>
                  <th className="text-left px-3 py-2">Dato</th>
                  <th className="text-center px-3 py-2">Status</th>
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
                              <button
                                onClick={() => toggleStages(race.id)}
                                className="text-warm-gray hover:text-ink transition-colors shrink-0 w-4 text-center"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            ) : (
                              <span className="w-4" />
                            )}
                            {race.name}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-warm-gray">
                          {isStageRace ? 'Etapeløb' : 'Endagsløb'}
                        </td>
                        <td className="px-3 py-2.5 text-warm-gray capitalize">
                          {race.profile}
                        </td>
                        <td className="px-3 py-2.5 text-warm-gray">
                          {race.start_date ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <select
                            value={race.status ?? 'upcoming'}
                            onChange={(e) =>
                              updateRaceStatus(race.id, e.target.value)
                            }
                            disabled={statusUpdating.has(race.id)}
                            className="font-condensed text-[11px] uppercase tracking-wide bg-cream border border-warm-border px-2 py-1 text-ink disabled:opacity-50"
                            style={{ borderRadius: '2px' }}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="active">Active</option>
                            <option value="finished">Finished</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-warm-gray text-[12px]">
                          {race.results_uploaded_at
                            ? formatDateTime(race.results_uploaded_at)
                            : '—'}
                        </td>
                      </tr>
                      {isStageRace && isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="bg-cream-dark border-b border-warm-border">
                              {isLoadingStages ? (
                                <p className="px-8 py-3 font-condensed text-[11px] text-warm-gray uppercase tracking-wide">
                                  Henter etaper...
                                </p>
                              ) : !stages || stages.length === 0 ? (
                                <p className="px-8 py-3 font-body text-[12px] text-warm-gray">
                                  Ingen etaper registreret.
                                </p>
                              ) : (
                                <table className="w-full font-body text-[12px]">
                                  <thead>
                                    <tr className="font-condensed text-[9px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border">
                                      <th className="text-left px-8 py-1.5">Etape</th>
                                      <th className="text-left px-3 py-1.5">Navn</th>
                                      <th className="text-left px-3 py-1.5">Profil</th>
                                      <th className="text-left px-3 py-1.5">Dato</th>
                                      <th className="text-left px-3 py-1.5">Resultater</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stages.map((stage) => (
                                      <tr
                                        key={stage.id}
                                        className="border-b border-warm-border/50"
                                      >
                                        <td className="px-8 py-1.5 text-ink font-medium">
                                          {stage.stage_number === 0
                                            ? 'Prolog'
                                            : `Etape ${stage.stage_number}`}
                                        </td>
                                        <td className="px-3 py-1.5 text-warm-gray">
                                          {stage.name ?? '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-warm-gray capitalize">
                                          {stage.profile ?? '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-warm-gray">
                                          {stage.start_date ?? '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-warm-gray">
                                          {stage.results_uploaded_at
                                            ? formatDateTime(stage.results_uploaded_at)
                                            : '—'}
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
        )}
      </div>

      {/* ── Sync log ─────────────────────────────────────────────── */}
      <div
        className="border border-warm-border bg-cream p-5"
        style={{ borderRadius: '2px' }}
      >
        <p
          className="font-condensed uppercase text-warm-gray mb-0.5"
          style={{ fontSize: '11px', letterSpacing: '0.1em' }}
        >
          Historik
        </p>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">
          Sync log
        </h2>

        {syncLogs.length === 0 ? (
          <p className="font-body text-[13px] text-warm-gray">
            Ingen sync-log entries endnu.
          </p>
        ) : (
          <div
            className="border border-warm-border overflow-hidden divide-y divide-warm-border"
            style={{ borderRadius: '2px' }}
          >
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="bg-cream px-4 py-3 flex items-start gap-3"
              >
                <StatusDot status={log.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-condensed text-[10px] font-bold text-warm-gray uppercase">
                      {log.sync_type}
                    </span>
                    <span className="font-body text-[11px] text-warm-gray">
                      {formatDateTime(log.created_at)}
                    </span>
                    {log.records_affected !== null && (
                      <span className="font-condensed text-[10px] text-warm-gray">
                        ({log.records_affected} records)
                      </span>
                    )}
                  </div>
                  <p className="font-body text-[13px] text-ink mt-0.5 truncate">
                    {log.message ?? '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
