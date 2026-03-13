/**
 * MANUEL FALLBACK — køres ikke automatisk.
 * Railway (railway/index.ts) er den primære cron-kilde via node-cron (dagligt 08:00 UTC).
 * Kan trigges manuelt via POST /api/admin/run-cron { cron: 'update-rounds' }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers.get('authorization'))
  if (authError) return authError

  const now = new Date()
  const nowIso = now.toISOString()

  // Hent ALLE runder (inkl. finished) så vi kan bestemme rækkefølge per liga
  const { data: allRounds, error: roundsError } = await supabaseAdmin
    .from('rounds')
    .select('id, name, status, betting_closes_at, league_id')
    .order('id', { ascending: true })

  if (roundsError) {
    return NextResponse.json({ error: roundsError.message }, { status: 500 })
  }

  type RoundRow = { id: number; name: string; status: string; betting_closes_at: string | null; league_id: number }
  const typedAllRounds = (allRounds ?? []) as RoundRow[]

  // Ikke-finished runder er dem vi skal arbejde med
  const rounds = typedAllRounds.filter((r) => r.status !== 'finished')
  const roundIds = rounds.map((r) => r.id)

  if (!roundIds.length) {
    return NextResponse.json({ ok: true, timestamp: nowIso, finished: 0, opened: 0, message: 'Ingen aktive runder' })
  }

  // Hent alle matches for ikke-finished runder (status + kickoff_at)
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

  // Byg effektiv status per liga (efter finished-markering)
  // Gruppér alle runder per liga i id-rækkefølge
  const roundsByLeague = new Map<number, RoundRow[]>()
  for (const r of typedAllRounds) {
    if (!roundsByLeague.has(r.league_id)) roundsByLeague.set(r.league_id, [])
    roundsByLeague.get(r.league_id)!.push(r)
  }

  // 2) Åbn næste upcoming runde per liga hvis:
  //    - Ingen anden runde i ligaen er 'open' eller 'closed'
  //    - Forrige runde (lavere id) er 'finished' eller findes ikke
  const toMarkOpen = typedRounds.filter((r) => {
    if (r.status !== 'upcoming') return false
    if (finishedIds.includes(r.id)) return false

    const leagueRounds = roundsByLeague.get(r.league_id) ?? []

    // Tjek at ingen anden runde i ligaen er open/closed (med finished-korrektion)
    const effectiveStatus = (rd: RoundRow) => finishedIds.includes(rd.id) ? 'finished' : rd.status
    const hasActiveRound = leagueRounds.some(
      (rd) => rd.id !== r.id && (effectiveStatus(rd) === 'open' || effectiveStatus(rd) === 'closed')
    )
    if (hasActiveRound) return false

    // Find forrige runde (lavere id) i samme liga
    const idx = leagueRounds.findIndex((rd) => rd.id === r.id)
    if (idx > 0) {
      const prev = leagueRounds[idx - 1]
      if (effectiveStatus(prev) !== 'finished') return false
    }

    return true
  })

  const openIds = toMarkOpen.map((r) => r.id)
  if (openIds.length > 0) {
    await supabaseAdmin
      .from('rounds')
      .update({ status: 'open' })
      .in('id', openIds)

  }

  // 3) Sæt betting_closes_at = 1 time før MIN(kickoff_at) for runder hvor den er NULL
  const toSetDeadline = typedRounds.filter((r) => {
    if (r.betting_closes_at) return false
    if (finishedIds.includes(r.id)) return false
    const stat = statMap[r.id]
    return stat && stat.minKickoff
  })

  for (const r of toSetDeadline) {
    const stat = statMap[r.id]
    const deadline = new Date(new Date(stat.minKickoff!).getTime() - 60 * 60 * 1000).toISOString()
    await supabaseAdmin
      .from('rounds')
      .update({ betting_closes_at: deadline })
      .eq('id', r.id)
  }

  await supabaseAdmin
    .from('admin_logs')
    .insert({
      type: 'update_rounds',
      status: finishedIds.length > 0 || openIds.length > 0 ? 'success' : 'info',
      message: `update-rounds: ${finishedIds.length} finished, ${openIds.length} opened, ${toSetDeadline.length} deadlines sat`,
      metadata: {
        rounds_marked_finished: finishedIds,
        rounds_marked_open: openIds,
        deadlines_set: toSetDeadline.map(r => r.id),
      }
    })

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
