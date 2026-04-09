import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const now = new Date()
    let lockedCount = 0

    // Find all unlocked lineups where the stage start_date - 30min has passed
    const { data: unlocked } = await supabaseAdmin
      .from('cycling_lineups')
      .select('id, stage_id, cycling_stages!inner(start_date)')
      .eq('is_locked', false)

    for (const lineup of unlocked ?? []) {
      const stage = lineup.cycling_stages as unknown as { start_date: string }
      if (!stage?.start_date) continue
      const deadline = new Date(new Date(stage.start_date).getTime() - 30 * 60 * 1000)
      if (deadline < now) {
        await supabaseAdmin
          .from('cycling_lineups')
          .update({ is_locked: true })
          .eq('id', lineup.id)
        lockedCount++
      }
    }

    return NextResponse.json({ ok: true, locked: lockedCount })
  } catch (err) {
    console.error('[admin/cycling/lock-lineups]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
