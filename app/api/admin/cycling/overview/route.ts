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
    { data: startlistCounts },
  ] = await Promise.all([
    supabaseAdmin
      .from('cycling_riders')
      .select('category, last_synced_at', { count: 'exact' }),
    supabaseAdmin
      .from('cycling_races')
      .select('id, name, pcs_slug, race_type, profile, start_date, year, status, results_uploaded_at, startlist_total')
      .order('start_date', { ascending: true }),
    supabaseAdmin
      .from('cycling_sync_log')
      .select('id, created_at, sync_type, records_affected, status, message')
      .order('created_at', { ascending: false })
      .limit(10),
    supabaseAdmin
      .from('cycling_startlists')
      .select('race_id'),
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

  // Build startlist count per race
  const startlistByRace: Record<string, number> = {}
  for (const row of startlistCounts ?? []) {
    startlistByRace[row.race_id] = (startlistByRace[row.race_id] ?? 0) + 1
  }

  // Attach startlist_count to each race
  const racesWithStartlist = (races ?? []).map((r) => ({
    ...r,
    startlist_count: startlistByRace[r.id] ?? 0,
  }))

  return NextResponse.json({
    riders: {
      total: riderCount ?? 0,
      byCategory,
      lastSynced,
    },
    races: racesWithStartlist,
    syncLogs: syncLogs ?? [],
  })
}
