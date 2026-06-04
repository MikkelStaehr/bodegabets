import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncCyclingStartlists } from '@/lib/syncCyclingStartlists'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/admin/cycling/sync-startlists
 * Body (valgfri): { year?: number } — default = nuværende år
 *
 * Trigger startlist-sync for alle upcoming/active races. Returnerer
 * tal til admin UI'en.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const year = typeof body?.year === 'number' ? body.year : new Date().getFullYear()

    const result = await syncCyclingStartlists(year)

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_startlists_sync',
      status: result.ok ? 'success' : 'error',
      message: `sync-startlists: ${result.racesProcessed} races, ${result.entriesUpserted} entries, ${result.unmatched} unmatched`,
      metadata: result as unknown as Record<string, unknown>,
    })

    return NextResponse.json({
      ok: result.ok,
      message: `${result.racesProcessed} løb · ${result.entriesUpserted} ryttere${result.unmatched > 0 ? ` · ${result.unmatched} ikke matchet` : ''}`,
      ...result,
    })
  } catch (err) {
    console.error('[admin/cycling/sync-startlists]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
