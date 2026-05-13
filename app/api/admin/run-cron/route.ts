/**
 * POST /api/admin/run-cron
 * Manuelt kør cron jobs (kræver admin).
 *
 * Body: { cron: 'batch-sync' | 'sync-scores' | 'update-rounds' | 'calculate-points' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

const ALLOWED_CRONS = new Set([
  'batch-sync',
  'sync-scores',
  'update-rounds',
  'calculate-points',
  'sync-cycling-results',
])

export const maxDuration = 65

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({})) as { cron?: string }
  const cron = body.cron

  if (!cron || !ALLOWED_CRONS.has(cron)) {
    return NextResponse.json(
      { ok: false, error: `Ugyldig cron. Brug: ${[...ALLOWED_CRONS].join(', ')}` },
      { status: 400 }
    )
  }

  const railwayUrl = process.env.RAILWAY_URL
  const cronSecret = process.env.CRON_SECRET

  if (!railwayUrl) {
    return NextResponse.json({ ok: false, error: 'RAILWAY_URL ikke konfigureret' }, { status: 500 })
  }
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET ikke konfigureret' }, { status: 500 })
  }

  try {
    const res = await fetch(`${railwayUrl}/${cron}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: (data as { error?: string }).error ?? `HTTP ${res.status}`, output: JSON.stringify(data) },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
