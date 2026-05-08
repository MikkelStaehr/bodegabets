import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { isStageDeadlinePassed } from '@/lib/cyclingDeadline'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const now = new Date()
    let lockedCount = 0

    // 1. Lock via block deadline
    const { data: expiredBlocks } = await supabaseAdmin
      .from('cycling_blocks')
      .select('id')
      .lt('lock_deadline', now.toISOString())

    const expiredBlockIds = (expiredBlocks ?? []).map((b) => b.id)

    if (expiredBlockIds.length > 0) {
      const { data: gameRaces } = await supabaseAdmin
        .from('cycling_game_races')
        .select('race_id')
        .in('cycling_block_id', expiredBlockIds)

      const raceIds = [...new Set((gameRaces ?? []).map((gr) => gr.race_id as string))]

      if (raceIds.length > 0) {
        const { data: stages } = await supabaseAdmin
          .from('cycling_stages')
          .select('id, start_date')
          .in('race_id', raceIds)

        const expiredStageIds = (stages ?? [])
          .filter((s) => isStageDeadlinePassed(s.start_date, now))
          .map((s) => s.id)

        if (expiredStageIds.length > 0) {
          const { data: locked } = await supabaseAdmin
            .from('cycling_lineups')
            .update({ is_locked: true })
            .eq('is_locked', false)
            .in('stage_id', expiredStageIds)
            .select('id')

          lockedCount += locked?.length ?? 0
        }
      }
    }

    // 2. Fallback: lock via individual stage start_date - 30min
    const { data: allUnlocked } = await supabaseAdmin
      .from('cycling_lineups')
      .select('id, stage_id, cycling_stages!inner(start_date)')
      .eq('is_locked', false)

    for (const lineup of allUnlocked ?? []) {
      const stage = lineup.cycling_stages as unknown as { start_date: string }
      if (isStageDeadlinePassed(stage?.start_date, now)) {
        await supabaseAdmin.from('cycling_lineups').update({ is_locked: true }).eq('id', lineup.id)
        lockedCount++
      }
    }

    return NextResponse.json({ ok: true, locked: lockedCount })
  } catch (err) {
    console.error('[admin/cycling/lock-lineups]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
