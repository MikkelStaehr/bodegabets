import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cronAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  const authError = requireCronAuth(request.headers.get('authorization'))
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const { job, duration_ms, status = 'success', message = '' } = body

  await supabaseAdmin.from('admin_logs').insert({
    type: 'railway_ping',
    status,
    message: `Railway → ${job}: ${message || status}`,
    metadata: { job, duration_ms, railway_timestamp: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true })
}
