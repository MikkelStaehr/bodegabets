import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const [
    { data: cronLogs },
    { data: boldLogs },
    { data: boldErrors },
  ] = await Promise.all([
    supabaseAdmin
      .from('admin_logs')
      .select('created_at, status, metadata')
      .in('type', ['sync_scores', 'sync_fixtures', 'update_rounds', 'calculate_points', 'send_reminders', 'railway_ping'])
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseAdmin
      .from('admin_logs')
      .select('created_at, status')
      .eq('type', 'bold_api')
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseAdmin
      .from('admin_logs')
      .select('id')
      .eq('type', 'bold_api')
      .eq('status', 'error')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ])

  const lastCron = cronLogs?.[0]
  const lastBold = boldLogs?.[0]
  const cronMeta = lastCron?.metadata as { next_run?: string } | null

  return NextResponse.json({
    cron: {
      lastRun: lastCron?.created_at ?? null,
      nextRun: cronMeta?.next_run ?? null,
      isHealthy: lastCron?.status === 'success',
    },
    boldApi: {
      lastSync: lastBold?.created_at ?? null,
      isHealthy: lastBold?.status === 'success',
      errorCount: boldErrors?.length ?? 0,
    },
  })
}
