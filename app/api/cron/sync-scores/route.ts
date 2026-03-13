/**
 * MANUEL FALLBACK — køres ikke automatisk.
 * Railway (railway/index.ts) er den primære cron-kilde via node-cron (hvert 5. min).
 * Kan trigges manuelt via POST /api/admin/run-cron { cron: 'sync-scores' }.
 */

import { NextResponse } from 'next/server'
import { syncMatchScores } from '@/lib/syncMatchScores'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cronAuth'

export const maxDuration = 30

export async function GET(request: Request) {
  const authError = requireCronAuth(request.headers.get('authorization'))
  if (authError) return authError

  try {
    const result = await syncMatchScores()
    const updated = (result as { updated?: number }).updated ?? 0
    const errors = (result as { errors?: string[] }).errors ?? []
    const hasErrors = errors.length > 0

    await supabaseAdmin
      .from('admin_logs')
      .insert({
        type: 'sync_scores',
        status: hasErrors && updated === 0 ? 'warning' : 'success',
        message: `sync-scores: ${updated} updated`,
        metadata: { updated, errors },
      })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        type: 'sync_scores',
        status: 'error',
        message: `sync-scores failed: ${String(e)}`,
      })
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
