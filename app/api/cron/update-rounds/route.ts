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

  const now = new Date().toISOString()

  // Hent alle aktive runder (ikke finished) med deres match-statistik
  const { data: rounds, error: roundsError } = await supabaseAdmin
    .from('rounds')
    .select('id, game_id, name, status')
    .neq('status', 'finished')

  if (roundsError) {
    return NextResponse.json({ error: roundsError.message }, { status: 500 })
  }

  const roundIds = (rounds ?? []).map((r: { id: number }) => r.id)
  if (!roundIds.length) {
    return NextResponse.json({ ok: true, timestamp: now, finished: 0, message: 'Ingen aktive runder' })
  }

  // Hent match-tæller per runde: total og finished
  const { data: matchStats, error: statsError } = await supabaseAdmin
    .from('matches')
    .select('round_id, status')
    .in('round_id', roundIds)

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 })
  }

  // Gruppér: tæl total og finished per round_id
  type MatchStat = { round_id: number; status: string }
  const statMap: Record<number, { total: number; finished: number }> = {}
  for (const m of (matchStats ?? []) as MatchStat[]) {
    if (!statMap[m.round_id]) statMap[m.round_id] = { total: 0, finished: 0 }
    statMap[m.round_id].total++
    if (m.status === 'finished') statMap[m.round_id].finished++
  }

  // Find runder hvor alle kampe er finished
  type RoundRow = { id: number; game_id: number; name: string; status: string }
  const toMarkFinished = (rounds as RoundRow[]).filter((r) => {
    const stat = statMap[r.id]
    return stat && stat.total > 0 && stat.finished === stat.total
  })

  const finishedIds = toMarkFinished.map((r) => r.id)

  if (finishedIds.length > 0) {
    await supabaseAdmin
      .from('rounds')
      .update({ status: 'finished' })
      .in('id', finishedIds)
  }

  console.log(
    `[cron/update-rounds] ${now} — markeret ${finishedIds.length} runder som finished`
  )

  return NextResponse.json({
    ok: true,
    timestamp: now,
    rounds_marked_finished: finishedIds.length,
    finished_rounds: toMarkFinished.map((r) => ({ id: r.id, name: r.name, game_id: r.game_id })),
  })
}
