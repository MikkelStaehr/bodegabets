/**
 * POST /api/admin/match-bold-ids
 * Matcher kampe med Bold.dk IDs. Køres fra admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { runMatchBoldIds, logMatchBoldRun } from '@/lib/matchBoldIds'

export const maxDuration = 90

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const result = await runMatchBoldIds()

    await logMatchBoldRun(
      result,
      result.errors.length ? 'error' : 'ok',
      result.errors.length ? result.errors.join('; ') : undefined
    )

    return NextResponse.json({
      ok: true,
      matched: result.matched,
      details: result.details,
      errors: result.errors,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukendt fejl'
    await logMatchBoldRun(
      { matched: 0, details: [], errors: [] },
      'error',
      msg
    )
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data } = await supabaseAdmin
    .from('bold_match_logs')
    .select('id, ran_at, matches_matched, details, status, error_message')
    .order('ran_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ logs: data ?? [] })
}
