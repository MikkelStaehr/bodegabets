import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const [
    { data: riders, count: riderCount },
    { data: races },
    { data: syncLogs },
  ] = await Promise.all([
    supabaseAdmin
      .from('cycling_riders')
      .select('category, last_synced_at', { count: 'exact' }),
    supabaseAdmin
      .from('cycling_races')
      .select('id, name, pcs_slug, race_type, profile, start_date, year, status, results_uploaded_at')
      .order('start_date', { ascending: true }),
    supabaseAdmin
      .from('cycling_sync_log')
      .select('id, created_at, sync_type, records_affected, status, message')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Build rider stats
  const byCategory: Record<number, number> = {}
  let lastSynced: string | null = null
  for (const r of riders ?? []) {
    const cat = r.category ?? 5
    byCategory[cat] = (byCategory[cat] ?? 0) + 1
    if (r.last_synced_at && (!lastSynced || r.last_synced_at > lastSynced)) {
      lastSynced = r.last_synced_at
    }
  }

  return NextResponse.json({
    riders: {
      total: riderCount ?? 0,
      byCategory,
      lastSynced,
    },
    races: races ?? [],
    syncLogs: syncLogs ?? [],
  })
}
