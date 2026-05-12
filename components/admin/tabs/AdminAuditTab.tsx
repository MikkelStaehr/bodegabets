'use client'

import { useEffect, useState } from 'react'

type AuditLog = {
  id: number
  actor_id: string | null
  actor_email: string | null
  action: string
  target_table: string | null
  target_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  'user.suspend': '#C8392B',
  'user.unsuspend': '#3D6B5A',
  'season.update': '#B8963E',
  'match.update_score': '#0C447C',
  'league.create': '#3D6B5A',
  'league.delete': '#C8392B',
}

export function AdminAuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (actionFilter) params.set('action', actionFilter)

    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoading(false))
  }, [actionFilter])

  // Unik liste af actions til filter-dropdown
  const distinctActions = [...new Set(logs.map((l) => l.action))].sort()

  if (loading) {
    return (
      <div className="px-5 py-12 text-center font-body text-sm text-warm-gray">
        Henter audit log...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-1 sm:px-5 pt-1 sm:pt-5">
        <label className="font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray font-bold">
          Filter:
        </label>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 sm:py-1.5 rounded-sm border border-warm-border bg-white text-sm font-body flex-1 sm:flex-none min-w-0"
        >
          <option value="">Alle handlinger</option>
          {distinctActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <span className="font-body text-xs text-warm-gray ml-auto">
          {logs.length} entries
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="px-5 py-12 text-center font-body text-sm text-warm-gray">
          Ingen handlinger logget endnu.
        </div>
      ) : (
        <div className="border-t border-warm-border bg-cream-dark">
          {logs.map((log, idx) => {
            const color = ACTION_COLORS[log.action] ?? '#7a7060'
            const timestamp = new Date(log.created_at).toLocaleString('da-DK', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            })
            return (
              <div
                key={log.id}
                className={`px-3 sm:px-5 py-3 ${idx > 0 ? 'border-t border-warm-border' : ''}`}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <span
                    className="font-condensed text-xs font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-sm flex-shrink-0"
                    style={{ background: `${color}1A`, color }}
                  >
                    {log.action}
                  </span>
                  <span className="font-body text-xs text-warm-gray flex-shrink-0">
                    {timestamp}
                  </span>
                  {log.actor_email && (
                    <span className="font-body text-xs text-ink/70">
                      {log.actor_email}
                    </span>
                  )}
                  {log.target_table && log.target_id && (
                    <span className="font-condensed text-xs text-warm-gray">
                      → {log.target_table}#{log.target_id}
                    </span>
                  )}
                </div>
                {(log.before || log.after || log.metadata) && (
                  <details className="mt-2">
                    <summary className="font-body text-xs text-warm-gray cursor-pointer hover:text-ink">
                      Detaljer
                    </summary>
                    <pre className="mt-2 p-3 bg-cream rounded-sm text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(
                        { before: log.before, after: log.after, metadata: log.metadata, ip: log.ip },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
