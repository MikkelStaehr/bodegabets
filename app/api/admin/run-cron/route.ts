/**
 * POST /api/admin/run-cron
 * Manuelt kør cron jobs (kræver admin).
 *
 * Body: { cron: 'sync-fixtures' | 'sync-scores' | 'update-rounds' | 'calculate-points' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

const CRON_ROUTES: Record<string, string> = {
  'sync-fixtures': '/api/cron/sync-fixtures',
  'sync-scores': '/api/cron/sync-scores',
  'update-rounds': '/api/cron/update-rounds',
  'calculate-points': '/api/cron/calculate-points',
}

export const maxDuration = 65

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({})) as { cron?: string }
  const cron = body.cron

  if (!cron || !CRON_ROUTES[cron]) {
    return NextResponse.json(
      { ok: false, error: `Ugyldig cron. Brug: ${Object.keys(CRON_ROUTES).join(', ')}` },
      { status: 400 }
    )
  }

  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET ikke konfigureret' }, { status: 500 })
  }

  const origin = req.nextUrl.origin
  const url = `${origin}${CRON_ROUTES[cron]}`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    const output = JSON.stringify(data, null, 2)

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: (data as { error?: string }).error ?? `HTTP ${res.status}`,
        output,
      })
    }

    return NextResponse.json({ ok: true, output })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg })
  }
}
