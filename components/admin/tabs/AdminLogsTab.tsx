'use client'

import { useState, useEffect } from 'react'

type Log = {
  id: number
  type: string
  status: string
  message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type Props = {
  adminSecret: string
}

const FILTERS = ['Alle', 'Cron', 'Bold API', 'Point', 'Brugere'] as const
const TYPE_MAP: Record<string, string> = {
  Alle: '',
  Cron: 'cron_sync',
  'Bold API': 'bold_api',
  Point: 'point_calc',
  Brugere: 'user_action',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('da-DK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') {
    return <span className="w-2 h-2 rounded-full bg-forest shrink-0" />
  }
  if (status === 'error') {
    return <span className="w-2 h-2 rounded-full bg-vintage-red animate-pulse shrink-0" />
  }
  if (status === 'warning') {
    return <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
  }
  return <span className="w-2 h-2 rounded-full bg-warm-gray shrink-0" />
}

export function AdminLogsTab({ adminSecret }: Props) {
  const [logs, setLogs] = useState<Log[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Alle')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const authHeader = { Authorization: `Bearer ${adminSecret}` }
  const typeParam = TYPE_MAP[filter]

  useEffect(() => {
    setLoading(true)
    const url = typeParam
      ? `/api/admin/logs?type=${encodeURIComponent(typeParam)}&limit=50`
      : '/api/admin/logs?limit=50'
    fetch(url, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [typeParam])

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-condensed text-[11px] font-bold px-3 py-1.5 transition-colors ${
              filter === f
                ? 'bg-forest text-cream'
                : 'bg-cream-dark text-warm-gray hover:bg-cream-dark/80 border border-warm-border'
            }`}
            style={{ borderRadius: '2px' }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="border border-warm-border bg-cream p-12 text-center font-body text-warm-gray" style={{ borderRadius: '2px' }}>
          Henter logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="border border-warm-border bg-cream p-12 text-center font-body text-warm-gray text-sm" style={{ borderRadius: '2px' }}>
          Ingen logs fundet
        </div>
      ) : (
        <div className="border border-warm-border overflow-hidden divide-y divide-warm-border" style={{ borderRadius: '2px' }}>
          {logs.map((log) => {
            const isExpanded = expandedId === log.id
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0
            return (
              <div key={log.id} className="bg-cream">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-cream-dark/40 transition-colors"
                >
                  <StatusIcon status={log.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-condensed text-[10px] font-bold text-warm-gray uppercase">
                        {log.type}
                      </span>
                      <span className="font-body text-[11px] text-warm-gray">
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                    <p className="font-body text-[13px] text-ink mt-0.5 truncate">
                      {log.message || '—'}
                    </p>
                  </div>
                  {hasMetadata && (
                    <span className="font-body text-[10px] text-warm-gray shrink-0">
                      {isExpanded ? '▲' : '▼'} JSON
                    </span>
                  )}
                </button>
                {isExpanded && hasMetadata && (
                  <div className="px-4 pb-3 pt-0">
                    <pre className="font-body text-[11px] bg-cream-dark border border-warm-border p-3 overflow-x-auto text-warm-gray" style={{ borderRadius: '2px' }}>
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
