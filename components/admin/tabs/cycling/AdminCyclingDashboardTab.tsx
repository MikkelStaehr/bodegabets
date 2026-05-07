'use client'

import React, { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/dateUtils'

type Props = Record<string, never>
type SyncLog = {
  id: string
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
    return <span className="w-2 h-2 rounded-full bg-vintage-red animate-pulse shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-warm-gray shrink-0" />
}

export function AdminCyclingDashboardTab() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [riderCount, setRiderCount] = useState<number>(0)
  const [raceCount, setRaceCount] = useState<number>(0)
  const [stageCount, setStageCount] = useState<number>(0)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [pointsMsg, setPointsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [lockLoading, setLockLoading] = useState(false)
  const [lockMsg, setLockMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const authHeader = {
    'Content-Type': 'application/json',
      }

  useEffect(() => {
    fetch('/api/admin/cycling/overview', { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (data.riders) {
          setRiderCount(data.riders.total ?? 0)
          setLastSynced(data.riders.lastSynced)
        }
        if (data.races) setRaceCount(data.races.length)
        if (data.syncLogs) setSyncLogs(data.syncLogs)
        // Count stages from races
        const stageRaces = (data.races ?? []).filter((r: { race_type: string }) => r.race_type === 'stage_race')
        setStageCount(stageRaces.length * 21) // estimate, will be refined
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFullSync() {
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
      setSyncMsg({ type: 'err', text: 'Netv\u00e6rksfejl' })
    } finally {
      setSyncLoading(false)
      setTimeout(() => setSyncMsg(null), 5000)
    }
  }

  async function handleCalcPoints() {
    setPointsLoading(true)
    setPointsMsg(null)
    try {
      const res = await fetch('/api/admin/cycling/calculate-points', {
        method: 'POST',
        headers: authHeader,
      })
      const data = await res.json()
      if (res.ok) {
        setPointsMsg({ type: 'ok', text: data.message ?? `${data.processed ?? 0} l\u00f8b beregnet` })
      } else {
        setPointsMsg({ type: 'err', text: data.error ?? 'Fejl' })
      }
    } catch {
      setPointsMsg({ type: 'err', text: 'Netv\u00e6rksfejl' })
    } finally {
      setPointsLoading(false)
      setTimeout(() => setPointsMsg(null), 5000)
    }
  }

  async function handleLockLineups() {
    setLockLoading(true)
    setLockMsg(null)
    try {
      const res = await fetch('/api/admin/cycling/lock-lineups', {
        method: 'POST',
        headers: authHeader,
      })
      const data = await res.json()
      if (res.ok) {
        setLockMsg({ type: 'ok', text: `${data.locked ?? 0} lineups l\u00e5st` })
      } else {
        setLockMsg({ type: 'err', text: data.error ?? 'Fejl' })
      }
    } catch {
      setLockMsg({ type: 'err', text: 'Netv\u00e6rksfejl' })
    } finally {
      setLockLoading(false)
      setTimeout(() => setLockMsg(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="border border-warm-border bg-cream p-8 text-center" style={{ borderRadius: '2px' }}>
        <p className="font-condensed text-[13px] text-warm-gray uppercase tracking-wide">Henter data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Quick stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Ryttere', value: riderCount },
          { label: 'L\u00f8b', value: raceCount },
          { label: 'Sidst synkroniseret', value: lastSynced ? formatDateTime(lastSynced) : 'Aldrig', small: true },
        ].map((stat) => (
          <div key={stat.label} className="border border-warm-border bg-cream p-4" style={{ borderRadius: '2px' }}>
            <span className="font-condensed text-[10px] uppercase text-warm-gray tracking-wide">{stat.label}</span>
            <p className={`font-condensed font-bold text-ink ${stat.small ? 'text-[13px] mt-1' : 'text-2xl'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Sync actions ─────────────────────────────────────────── */}
      <div className="border border-warm-border bg-cream p-5" style={{ borderRadius: '2px' }}>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">Synkronisering</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleFullSync}
            disabled={syncLoading}
            className="inline-flex items-center gap-1.5 font-condensed text-[12px] font-semibold text-forest px-4 py-2 border border-warm-border hover:bg-cream-dark disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '2px' }}
          >
            {syncLoading ? 'Synkroniserer...' : 'K\u00f8r fuld sync'}
          </button>
          <button
            onClick={handleCalcPoints}
            disabled={pointsLoading}
            className="inline-flex items-center gap-1.5 font-condensed text-[12px] font-semibold text-forest px-4 py-2 border border-warm-border hover:bg-cream-dark disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '2px' }}
          >
            {pointsLoading ? 'Beregner...' : 'Beregn point'}
          </button>
          <button
            onClick={handleLockLineups}
            disabled={lockLoading}
            className="inline-flex items-center gap-1.5 font-condensed text-[12px] font-semibold text-vintage-red px-4 py-2 border border-vintage-red/30 hover:bg-vintage-red/5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '2px' }}
          >
            {lockLoading ? 'L\u00e5ser...' : 'L\u00e5s lineups'}
          </button>
          {syncMsg && <span className={`font-body text-[12px] ${syncMsg.type === 'ok' ? 'text-forest' : 'text-vintage-red'}`}>{syncMsg.text}</span>}
          {pointsMsg && <span className={`font-body text-[12px] ${pointsMsg.type === 'ok' ? 'text-forest' : 'text-vintage-red'}`}>{pointsMsg.text}</span>}
          {lockMsg && <span className={`font-body text-[12px] ${lockMsg.type === 'ok' ? 'text-forest' : 'text-vintage-red'}`}>{lockMsg.text}</span>}
        </div>
      </div>

      {/* ── Sync log ─────────────────────────────────────────────── */}
      <div className="border border-warm-border bg-cream p-5" style={{ borderRadius: '2px' }}>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">Sync log</h2>
        {syncLogs.length === 0 ? (
          <p className="font-body text-[13px] text-warm-gray">Ingen sync-log entries endnu.</p>
        ) : (
          <div className="border border-warm-border overflow-hidden divide-y divide-warm-border" style={{ borderRadius: '2px' }}>
            {syncLogs.map((log) => (
              <div key={log.id} className="bg-cream px-4 py-3 flex items-start gap-3">
                <StatusDot status={log.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-condensed text-[10px] font-bold text-warm-gray uppercase">{log.sync_type}</span>
                    <span className="font-body text-[11px] text-warm-gray">{formatDateTime(log.created_at)}</span>
                    {log.records_affected !== null && (
                      <span className="font-condensed text-[10px] text-warm-gray">({log.records_affected} records)</span>
                    )}
                  </div>
                  <p className="font-body text-[13px] text-ink mt-0.5 truncate">{log.message ?? '\u2014'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
