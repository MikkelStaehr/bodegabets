'use client'

import { useEffect, useState } from 'react'

const CRON_JOBS = [
  { id: 'sync-fixtures',  label: 'Sync fixtures',  schedule: 'hver 30 min' },
  { id: 'sync-scores',    label: 'Sync scores',    schedule: 'hvert 5 min' },
  { id: 'update-rounds',  label: 'Opdater runder', schedule: 'kl. 08:00'   },
  { id: 'send-reminders', label: 'Send reminders', schedule: 'kl. 10:00'   },
]

export default function OverblikTab() {
  const [status, setStatus] = useState<any>(null)
  const [pings, setPings] = useState<any[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/status').then(r => r.json()).then(setStatus)
    fetch('/api/admin/logs?limit=8&type=railway_ping').then(r => r.json()).then(d => setPings(d.logs || []))
  }, [])

  async function runCron(job: string) {
    setRunning(job)
    setRunResult(null)
    try {
      const res = await fetch('/api/admin/run-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron: job }),
      })
      const d = await res.json()
      setRunResult(d.ok ? 'Udført' : (d.error || 'Fejl'))
    } catch {
      setRunResult('Fejl')
    }
    setRunning(null)
  }

  const boldOk = (status?.boldApi?.errorCount ?? 1) === 0

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8C8C78', marginBottom: '3px' }}>
            {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', color: '#2C4A3E', letterSpacing: '-0.01em' }}>
            Overblik
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

      {/* Cron jobs */}
      <div>
        <Label>Cron jobs</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CRON_JOBS.map(job => (
            <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', background: '#fff', border: '1px solid rgba(44,74,62,0.1)', borderRadius: '3px' }}>
              <div>
                <div style={{ fontFamily: 'sans-serif', fontSize: '12px', fontWeight: 700, color: '#2C4A3E' }}>{job.label}</div>
                <div style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#8C8C78', marginTop: '2px' }}>{job.schedule}</div>
              </div>
              <button
                onClick={() => runCron(job.id)}
                disabled={running === job.id}
                style={{
                  fontFamily: 'sans-serif',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  border: '1px solid rgba(44,74,62,0.2)',
                  color: '#2C4A3E',
                  padding: '3px 8px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  opacity: running === job.id ? 0.5 : 1,
                }}
              >
                {running === job.id ? '…' : 'Kør nu'}
              </button>
            </div>
          ))}
          {runResult && (
            <div style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#2C7A50', padding: '8px 12px', background: 'rgba(44,122,80,0.06)', borderRadius: '3px' }}>
              ✓ {runResult}
            </div>
          )}
        </div>
      </div>

      {/* Railway heartbeat */}
      <div>
        <Label>Railway — seneste pings</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {pings.length === 0 && (
            <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#8C8C78', padding: '16px', background: '#fff', border: '1px solid rgba(44,74,62,0.1)', borderRadius: '3px' }}>
              Ingen Railway-pings endnu — deploy til Vercel og sæt NEXT_PUBLIC_APP_URL i Railway
            </div>
          )}
          {pings.map((log: any) => (
            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '10px', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid rgba(44,74,62,0.08)', borderRadius: '3px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: log.status === 'success' ? '#2C7A50' : '#C0392B', display: 'inline-block' }} />
              <div>
                <span style={{ fontFamily: 'sans-serif', fontSize: '12px', fontWeight: 700, color: '#2C4A3E' }}>{log.metadata?.job ?? log.message}</span>
                {log.metadata?.duration_ms && (
                  <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#8C8C78', marginLeft: '8px' }}>{log.metadata.duration_ms}ms</span>
                )}
              </div>
              <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#8C8C78' }}>
                {new Date(log.created_at).toLocaleString('da-DK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* System status — fuld bredde */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Label>System</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <StatusCard
            label="Bold API"
            ok={boldOk}
            value={status?.boldApi?.lastSync ?? '—'}
            detail={`${status?.boldApi?.errorCount ?? '?'} fejl seneste 24t`}
          />
          <StatusCard
            label="Cron"
            ok={true}
            value={status?.cron?.lastRun ?? '—'}
            detail="Sidst kørt"
          />
          <StatusCard
            label="Database"
            ok={true}
            value="OK"
            detail={`${status?.db?.users ?? '?'} brugere · ${status?.db?.games ?? '?'} spilrum`}
          />
        </div>
      </div>

    </div>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8C8C78', marginBottom: '12px' }}>{children}</div>
}

function StatusCard({ label, ok, value, detail }: { label: string, ok: boolean, value: string, detail: string }) {
  return (
    <div style={{ padding: '16px 20px', background: '#fff', border: `1px solid ${ok ? 'rgba(44,74,62,0.1)' : 'rgba(192,57,43,0.25)'}`, borderRadius: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ok ? '#2C7A50' : '#C0392B', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8C8C78' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#2C4A3E', marginBottom: '4px', letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#8C8C78' }}>{detail}</div>
    </div>
  )
}
