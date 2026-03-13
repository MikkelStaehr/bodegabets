'use client'

import { useEffect, useState, useCallback } from 'react'

const FILTERS = [
  { id: '',                  label: 'Alle'      },
  { id: 'railway_ping',      label: 'Railway'   },
  { id: 'sync_scores',       label: 'Scores'    },
  { id: 'sync_fixtures',     label: 'Fixtures'  },
  { id: 'calculate_points',  label: 'Point'     },
  { id: 'update_rounds',     label: 'Runder'    },
  { id: 'send_reminders',    label: 'Reminders' },
]

const DOT: Record<string, string> = {
  success: '#2C7A50',
  warning: '#B8963E',
  error:   '#C0392B',
}

export default function LogsTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const url = `/api/admin/logs?limit=100${filter ? `&type=${filter}` : ''}`
    const d = await fetch(url).then(r => r.json())
    setLogs(d.logs || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', color: '#2C4A3E', marginBottom: '24px', letterSpacing: '-0.01em' }}>Logs</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{ fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '2px', border: '1px solid rgba(44,74,62,0.2)', background: filter === f.id ? '#2C4A3E' : 'transparent', color: filter === f.id ? '#F2EDE4' : '#5C5C4A', cursor: 'pointer' }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          style={{ fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '2px', border: '1px solid rgba(44,74,62,0.2)', background: 'transparent', color: '#5C5C4A', cursor: 'pointer' }}
        >
          ↻ Opdater
        </button>
      </div>

      {loading ? (
        <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#8C8C78' }}>Henter logs…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {logs.map(log => (
            <div key={log.id}>
              <div
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                style={{ display: 'grid', gridTemplateColumns: '8px 120px 70px 1fr 120px', gap: '12px', alignItems: 'center', padding: '9px 14px', background: '#fff', border: '1px solid rgba(44,74,62,0.08)', borderRadius: expanded === log.id ? '3px 3px 0 0' : '3px', cursor: 'pointer' }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: DOT[log.status] || '#8C8C78', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontFamily: 'sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8C8C78', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.type.replace(/_/g, ' ')}</span>
                <span style={{ fontFamily: 'sans-serif', fontSize: '10px', fontWeight: 700, color: DOT[log.status], textTransform: 'uppercase', letterSpacing: '0.08em' }}>{log.status}</span>
                <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#2C4A3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</span>
                <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#8C8C78', textAlign: 'right' }}>
                  {new Date(log.created_at).toLocaleString('da-DK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {expanded === log.id && (
                <div style={{ padding: '12px 16px', background: '#F8F6F0', border: '1px solid rgba(44,74,62,0.08)', borderTop: 'none', borderRadius: '0 0 3px 3px', fontFamily: 'monospace', fontSize: '11px', color: '#5C5C4A', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {JSON.stringify(log.metadata, null, 2)}
                </div>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#8C8C78', paddingTop: '24px' }}>Ingen logs fundet</div>
          )}
        </div>
      )}
    </div>
  )
}
