import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { endpoint } = await req.json()

  const ALLOWED_ENDPOINTS = [
    'sync-fixtures',
    'sync-scores',
    'update-rounds',
    'calculate-points',
    'batch-sync',
    'cycling-lock-lineups',
    'cycling-points',
  ]

  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: 'Ukendt endpoint' }, { status: 400 })
  }

  const railwayUrl = process.env.RAILWAY_URL ?? 'https://bodegabets-production.up.railway.app'

  fetch(`${railwayUrl}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true, message: 'Job startet på Railway' })
}
