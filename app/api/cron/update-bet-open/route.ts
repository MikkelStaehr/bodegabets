import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const nowIso = now.toISOString()

  // 1) Sæt alle runder til bet_open = false
  const { error: resetError2 } = await supabaseAdmin
    .from('rounds')
    .update({ bet_open: false })
    .gte('id', 0)

  if (resetError2) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_bet_open',
      status: 'error',
      message: `Reset bet_open failed: ${resetError2.message}`,
    })
    return NextResponse.json({ error: resetError2.message }, { status: 500 })
  }

  // 2) Hent alle ikke-finished runder med betting_closes_at > now
  const { data: candidateRounds, error: fetchError } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id, betting_closes_at')
    .neq('status', 'finished')
    .gt('betting_closes_at', nowIso)
    .order('betting_closes_at', { ascending: true })

  if (fetchError) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_bet_open',
      status: 'error',
      message: `Fetch rounds failed: ${fetchError.message}`,
    })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // 3) Vælg de 2 nærmeste per season_id
  type CandidateRound = { id: number; season_id: number; betting_closes_at: string }
  const rounds = (candidateRounds ?? []) as CandidateRound[]
  const countBySeason = new Map<number, number>()
  const idsToOpen: number[] = []

  for (const r of rounds) {
    const count = countBySeason.get(r.season_id) ?? 0
    if (count < 2) {
      idsToOpen.push(r.id)
      countBySeason.set(r.season_id, count + 1)
    }
  }

  // 4) Sæt bet_open = true for de valgte runder
  if (idsToOpen.length > 0) {
    const { error: openError } = await supabaseAdmin
      .from('rounds')
      .update({ bet_open: true })
      .in('id', idsToOpen)

    if (openError) {
      await supabaseAdmin.from('admin_logs').insert({
        type: 'update_bet_open',
        status: 'error',
        message: `Set bet_open failed: ${openError.message}`,
      })
      return NextResponse.json({ error: openError.message }, { status: 500 })
    }
  }

  console.log(`[cron/update-bet-open] ${nowIso} — bet_open=true for ${idsToOpen.length} runder: [${idsToOpen.join(', ')}]`)

  await supabaseAdmin.from('admin_logs').insert({
    type: 'update_bet_open',
    status: 'success',
    message: `bet_open opdateret: ${idsToOpen.length} runder åbnet`,
    metadata: { round_ids: idsToOpen, timestamp: nowIso },
  })

  return NextResponse.json({ updated: true, timestamp: nowIso, rounds_opened: idsToOpen })
}
