/**
 * MANUEL FALLBACK — køres ikke automatisk.
 * Railway (railway/index.ts) er den primære cron-kilde via node-cron (dagligt 08:00 UTC).
 * Kan trigges manuelt via POST /api/admin/run-cron { cron: 'update-rounds' }.
 *
 * Matches har season_id + round_name (ikke round_id). Join via rounds.season_id, rounds.name.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers.get('authorization'))
  if (authError) return authError

  const now = new Date()
  const nowIso = now.toISOString()
  const errors: string[] = []

  const { data: allRounds, error: roundsError } = await supabaseAdmin
    .from('rounds')
    .select('id, name, status, betting_closes_at, season_id')
    .order('id', { ascending: true })

  if (roundsError) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_rounds',
      status: 'error',
      message: `update-rounds: fetch fejl: ${roundsError.message}`,
      metadata: { error: roundsError.message },
    })
    return NextResponse.json({ error: roundsError.message }, { status: 500 })
  }

  type RoundRow = { id: number; name: string; status: string; betting_closes_at: string | null; season_id: number }
  const typedAllRounds = (allRounds ?? []) as RoundRow[]

  const rounds = typedAllRounds.filter((r) => r.status !== 'finished')
  const roundIds = rounds.map((r) => r.id)

  if (!roundIds.length) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_rounds',
      status: 'info',
      message: 'update-rounds: Ingen aktive runder',
      metadata: { rounds_checked: typedAllRounds.length },
    })
    return NextResponse.json({ ok: true, timestamp: nowIso, finished: 0, opened: 0, closed: 0, message: 'Ingen aktive runder' })
  }

  // Matches har season_id + round_name. Hent alle matches for disse sæsoner og gruppér per (season_id, round_name)
  const seasonIds = [...new Set(rounds.map((r) => r.season_id))]
  const { data: matchRows, error: statsError } = await supabaseAdmin
    .from('matches')
    .select('season_id, round_name, status, kickoff')
    .in('season_id', seasonIds)

  if (statsError) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_rounds',
      status: 'error',
      message: `update-rounds: matches fetch fejl: ${statsError.message}`,
      metadata: { error: statsError.message },
    })
    return NextResponse.json({ error: statsError.message }, { status: 500 })
  }

  type MatchRow = { season_id: number; round_name: string; status: string; kickoff: string | null }
  const statsBySeasonRound = new Map<string, { total: number; finished: number; minKickoff: string | null }>()
  for (const m of (matchRows ?? []) as MatchRow[]) {
    const key = `${m.season_id}|${m.round_name}`
    const entry = statsBySeasonRound.get(key) ?? { total: 0, finished: 0, minKickoff: null }
    entry.total++
    if (m.status === 'finished') entry.finished++
    if (m.kickoff) {
      if (!entry.minKickoff || m.kickoff < entry.minKickoff) entry.minKickoff = m.kickoff
    }
    statsBySeasonRound.set(key, entry)
  }

  const statMap: Record<number, { total: number; finished: number; minKickoff: string | null }> = {}
  for (const r of rounds) {
    const key = `${r.season_id}|${r.name}`
    statMap[r.id] = statsBySeasonRound.get(key) ?? { total: 0, finished: 0, minKickoff: null }
  }

  const typedRounds = rounds as RoundRow[]

  // 1) Markér runder som 'finished' hvis forbi betting_closes_at OG alle kampe er 'finished'
  const toMarkFinished = typedRounds.filter((r) => {
    const stat = statMap[r.id]
    if (!stat || stat.total === 0 || stat.finished !== stat.total) return false
    const closes = r.betting_closes_at ? new Date(r.betting_closes_at) : null
    return closes != null && closes < now
  })

  const finishedIds = toMarkFinished.map((r) => r.id)
  if (finishedIds.length > 0) {
    await supabaseAdmin.from('rounds').update({ status: 'finished' }).in('id', finishedIds)
  }

  const roundsBySeason = new Map<number, RoundRow[]>()
  for (const r of typedAllRounds) {
    if (!roundsBySeason.has(r.season_id)) roundsBySeason.set(r.season_id, [])
    roundsBySeason.get(r.season_id)!.push(r)
  }

  const effectiveStatus = (rd: RoundRow) => (finishedIds.includes(rd.id) ? 'finished' : rd.status)

  // 2) Sæt runder til 'open' hvis betting_closes_at > now() og runden har kommende kampe
  const toMarkOpen = typedRounds.filter((r) => {
    if (r.status !== 'upcoming') return false
    if (finishedIds.includes(r.id)) return false

    const seasonRounds = roundsBySeason.get(r.season_id) ?? []
    const hasActiveRound = seasonRounds.some(
      (rd) => rd.id !== r.id && (effectiveStatus(rd) === 'open' || effectiveStatus(rd) === 'closed')
    )
    if (hasActiveRound) return false

    const idx = seasonRounds.findIndex((rd) => rd.id === r.id)
    if (idx > 0) {
      const prev = seasonRounds[idx - 1]
      if (effectiveStatus(prev) !== 'finished') return false
    }

    const closes = r.betting_closes_at ? new Date(r.betting_closes_at) : null
    return closes != null && closes > now
  })

  const openIds = toMarkOpen.map((r) => r.id)
  if (openIds.length > 0) {
    await supabaseAdmin.from('rounds').update({ status: 'open' }).in('id', openIds)
  }

  // 3) Sæt runder til 'closed' hvis betting_closes_at < now() men ikke alle kampe er finished
  const toMarkClosed = typedRounds.filter((r) => {
    if (r.status !== 'open') return false
    if (finishedIds.includes(r.id)) return false

    const closes = r.betting_closes_at ? new Date(r.betting_closes_at) : null
    if (!closes || closes >= now) return false

    const stat = statMap[r.id]
    return stat && stat.total > 0 && stat.finished < stat.total
  })

  const closedIds = toMarkClosed.map((r) => r.id)
  if (closedIds.length > 0) {
    await supabaseAdmin.from('rounds').update({ status: 'closed' }).in('id', closedIds)
  }

  // 4) Sæt betting_closes_at for runder hvor den er NULL (fra matches)
  const toSetDeadline = typedRounds.filter((r) => {
    if (r.betting_closes_at) return false
    if (finishedIds.includes(r.id)) return false
    const stat = statMap[r.id]
    return stat && stat.minKickoff
  })

  for (const r of toSetDeadline) {
    const stat = statMap[r.id]
    if (!stat?.minKickoff) continue
    const { error } = await supabaseAdmin
      .from('rounds')
      .update({ betting_closes_at: stat.minKickoff })
      .eq('id', r.id)
      .is('betting_closes_at', null)
    if (error) errors.push(`betting_closes_at fejl for runde ${r.id}: ${error.message}`)
  }

  await supabaseAdmin.from('admin_logs').insert({
    type: 'update_rounds',
    status: errors.length > 0 ? 'warning' : (finishedIds.length > 0 || openIds.length > 0 || closedIds.length > 0 ? 'success' : 'info'),
    message: `update-rounds: ${finishedIds.length} finished, ${openIds.length} opened, ${closedIds.length} closed, ${toSetDeadline.length} deadlines sat`,
    metadata: {
      rounds_marked_finished: finishedIds,
      rounds_marked_open: openIds,
      rounds_marked_closed: closedIds,
      deadlines_set: toSetDeadline.map((r) => r.id),
      errors: errors.length > 0 ? errors : undefined,
    },
  })

  return NextResponse.json({
    ok: true,
    timestamp: nowIso,
    rounds_marked_finished: finishedIds.length,
    rounds_marked_open: openIds.length,
    rounds_marked_closed: closedIds.length,
    deadlines_set: toSetDeadline.length,
    errors: errors.length > 0 ? errors : undefined,
    finished_rounds: toMarkFinished.map((r) => ({ id: r.id, name: r.name })),
    opened_rounds: toMarkOpen.map((r) => ({ id: r.id, name: r.name })),
    closed_rounds: toMarkClosed.map((r) => ({ id: r.id, name: r.name })),
  })
}
