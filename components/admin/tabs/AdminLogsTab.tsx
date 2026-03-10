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
    return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
  }
  if (status === 'error') {
    return <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
  }
  if (status === 'warning') {
    return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
  }
  return <span className="w-2 h-2 rounded-full bg-[#7a7060] shrink-0" />
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
            className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${
              filter === f
                ? 'bg-[#2C4A3E] text-white'
                : 'bg-black/5 text-[#7a7060] hover:bg-black/10'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-black/8 bg-white p-12 text-center text-[#7a7060]">
          Henter logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-black/8 bg-white p-12 text-center text-[#7a7060] text-sm">
          Ingen logs fundet
        </div>
      ) : (
        <div className="rounded-xl border border-black/8 overflow-hidden divide-y divide-black/6">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0
            return (
              <div key={log.id} className="bg-white">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-black/[0.02] transition-colors"
                >
                  <StatusIcon status={log.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[#7a7060] uppercase">
                        {log.type}
                      </span>
                      <span className="text-[11px] text-[#7a7060]">
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#1a3329] mt-0.5 truncate">
                      {log.message || '—'}
                    </p>
                  </div>
                  {hasMetadata && (
                    <span className="text-[10px] text-[#7a7060] shrink-0">
                      {isExpanded ? '▲' : '▼'} JSON
                    </span>
                  )}
                </button>
                {isExpanded && hasMetadata && (
                  <div className="px-4 pb-3 pt-0">
                    <pre className="text-[11px] bg-black/5 rounded-lg p-3 overflow-x-auto text-[#7a7060]">
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
