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
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Hent alle aktive runder (ikke finished) med deres match-statistik
  const { data: rounds, error: roundsError } = await supabaseAdmin
    .from('rounds')
    .select('id, name, status, betting_closes_at')
    .neq('status', 'finished')

  if (roundsError) {
    return NextResponse.json({ error: roundsError.message }, { status: 500 })
  }

  const roundIds = (rounds ?? []).map((r: { id: number }) => r.id)
  if (!roundIds.length) {
    return NextResponse.json({ ok: true, timestamp: nowIso, finished: 0, opened: 0, message: 'Ingen aktive runder' })
  }

  // Hent alle matches for disse runder (status + kickoff_at)
  const { data: matchRows, error: statsError } = await supabaseAdmin
    .from('matches')
    .select('round_id, status, kickoff_at')
    .in('round_id', roundIds)

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 })
  }

  // Gruppér per round_id: total, finished, og min(kickoff_at)
  type MatchRow = { round_id: number; status: string; kickoff_at: string | null }
  const statMap: Record<number, { total: number; finished: number; minKickoff: string | null }> = {}
  for (const m of (matchRows ?? []) as MatchRow[]) {
    if (!statMap[m.round_id]) statMap[m.round_id] = { total: 0, finished: 0, minKickoff: null }
    statMap[m.round_id].total++
    if (m.status === 'finished') statMap[m.round_id].finished++
    if (m.kickoff_at) {
      if (!statMap[m.round_id].minKickoff || m.kickoff_at < statMap[m.round_id].minKickoff!) {
        statMap[m.round_id].minKickoff = m.kickoff_at
      }
    }
  }

  type RoundRow = { id: number; name: string; status: string; betting_closes_at: string | null }
  const typedRounds = rounds as RoundRow[]

  // 1) Markér runder som 'finished' hvor alle kampe er finished
  const toMarkFinished = typedRounds.filter((r) => {
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

  // 2) Markér 'upcoming' runder som 'open' når MIN(kickoff_at) <= now + 7 dage
  const toMarkOpen = typedRounds.filter((r) => {
    if (r.status !== 'upcoming') return false
    if (finishedIds.includes(r.id)) return false
    const stat = statMap[r.id]
    if (!stat || !stat.minKickoff) return false
    return stat.minKickoff <= sevenDaysFromNow
  })

  const openIds = toMarkOpen.map((r) => r.id)
  if (openIds.length > 0) {
    await supabaseAdmin
      .from('rounds')
      .update({ status: 'open' })
      .in('id', openIds)
  }

  // 3) Sæt betting_closes_at = MIN(kickoff_at) for runder hvor den er NULL
  const toSetDeadline = typedRounds.filter((r) => {
    if (r.betting_closes_at) return false
    if (finishedIds.includes(r.id)) return false
    const stat = statMap[r.id]
    return stat && stat.minKickoff
  })

  for (const r of toSetDeadline) {
    const stat = statMap[r.id]
    await supabaseAdmin
      .from('rounds')
      .update({ betting_closes_at: stat.minKickoff })
      .eq('id', r.id)
  }

  console.log(
    `[cron/update-rounds] ${nowIso} — finished: ${finishedIds.length}, opened: ${openIds.length}, deadlines set: ${toSetDeadline.length}`
  )

  return NextResponse.json({
    ok: true,
    timestamp: nowIso,
    rounds_marked_finished: finishedIds.length,
    rounds_marked_open: openIds.length,
    deadlines_set: toSetDeadline.length,
    finished_rounds: toMarkFinished.map((r) => ({ id: r.id, name: r.name })),
    opened_rounds: toMarkOpen.map((r) => ({ id: r.id, name: r.name })),
  })
}
