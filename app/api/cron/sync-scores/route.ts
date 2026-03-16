import { NextResponse } from 'next/server'
import { syncMatchScores } from '@/lib/syncMatchScores'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 30

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncMatchScores()

    await supabaseAdmin
      .from('admin_logs')
      .insert({
        type: 'cron_sync',
        status: 'success',
        message: `sync-scores: ${(result as Record<string, unknown>).updated ?? 0} updated`,
        metadata: result,
      })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        type: 'cron_sync',
        status: 'error',
        message: `sync-scores failed: ${String(e)}`,
      })
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
