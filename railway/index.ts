/**
 * Bodega Bets — Railway Cron Service
 *
 * Standalone Express server der kører cron jobs for Bodega Bets.
 * Erstatter Vercel cron (som kun tillader daglige jobs på Hobby).
 *
 * Endpoints:
 *   GET /sync-scores       — hvert 5. min (sync live scores fra Bold API)
 *   GET /sync-fixtures     — dagligt 06:00 (sync fixtures fra Bold API)
 *   GET /update-rounds     — dagligt 08:00 (opdater runde-status)
 *   (calculate-points køres event-drevet fra syncMatchScores — ikke som cron)
 *   GET /send-reminders    — dagligt 10:00 (send push-notifikationer)
 *   GET /health            — health check
 *
 * Environment:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CRON_SECRET
 *   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   PORT (default 3000)
 */

import express from 'express'
import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { syncMatchScores } from '@/lib/syncMatchScores'
import { runLeagueSync } from '@/lib/syncLeagueMatches'
import { calculateRoundPoints, syncProfilesPoints } from '@/lib/calculatePoints'

async function pingAdmin(job: string, durationMs: number, status: 'success' | 'error', message: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/railway-ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ job, duration_ms: durationMs, status, message }),
    })
  } catch {
    // Best effort
  }
}

const app = express()
const PORT = parseInt(process.env.PORT ?? '3000', 10)

// ─── Supabase admin client ──────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── GET /health (public, no auth) ──────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// ─── Auth middleware (all routes below require CRON_SECRET) ─────────────────

function authorize(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

app.use(authorize)

// ─── GET /sync-scores ───────────────────────────────────────────────────────

app.get('/sync-scores', async (_req, res) => {
  try {
    const result = await syncMatchScores()
    const updated = (result as { updated?: number }).updated ?? 0
    const errors = (result as { errors?: string[] }).errors ?? []
    const hasErrors = errors.length > 0

    await supabaseAdmin.from('admin_logs').insert({
      type: 'sync_scores',
      status: hasErrors && updated === 0 ? 'warning' : 'success',
      message: `sync-scores: ${updated} updated`,
      metadata: { updated, errors },
    })

    res.json({ ok: true, ...result })
  } catch (e) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'sync_scores',
      status: 'error',
      message: `sync-scores failed: ${String(e)}`,
    })
    res.status(500).json({ ok: false, error: String(e) })
  }
})

// ─── GET /sync-fixtures ─────────────────────────────────────────────────────

app.get('/sync-fixtures', async (_req, res) => {
  try {
    const results = await runLeagueSync()

    const totals = results.reduce(
      (acc, r) => ({
        synced: acc.synced + r.synced,
        rounds_upserted: acc.rounds_upserted + r.rounds_upserted,
        matches_created: acc.matches_created + r.matches_created,
        matches_updated: acc.matches_updated + r.matches_updated,
      }),
      { synced: 0, rounds_upserted: 0, matches_created: 0, matches_updated: 0 }
    )

    await supabaseAdmin.from('admin_logs').insert({
      type: 'sync_fixtures',
      status: totals.synced > 0 ? 'success' : 'info',
      message: `sync-fixtures: ${results.length} sæsoner, ${totals.matches_created} created, ${totals.matches_updated} updated`,
      metadata: { seasons_synced: results.length, ...totals },
    })

    res.json({
      ok: true,
      synced_at: new Date().toISOString(),
      seasons_synced: results.length,
      ...totals,
      details: results,
    })
  } catch (err) {
    console.error('[sync-fixtures]', err)
    await supabaseAdmin.from('admin_logs').insert({
      type: 'sync_fixtures',
      status: 'error',
      message: `sync-fixtures failed: ${String(err)}`,
    })
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /update-rounds ─────────────────────────────────────────────────────

app.get('/update-rounds', async (_req, res) => {
  try {
    const now = new Date()
    const nowIso = now.toISOString()

    const { data: allRounds, error: roundsError } = await supabaseAdmin
      .from('rounds')
      .select('id, name, status, betting_closes_at, season_id')
      .order('id', { ascending: true })

    if (roundsError) {
      res.status(500).json({ error: roundsError.message })
      return
    }

    type RoundRow = { id: number; name: string; status: string; betting_closes_at: string | null; season_id: number }
    const typedAllRounds = (allRounds ?? []) as RoundRow[]
    const rounds = typedAllRounds.filter((r) => r.status !== 'finished')
    const roundIds = rounds.map((r) => r.id)

    if (!roundIds.length) {
      res.json({ ok: true, timestamp: nowIso, finished: 0, opened: 0, message: 'Ingen aktive runder' })
      return
    }

    const { data: matchRows, error: statsError } = await supabaseAdmin
      .from('matches')
      .select('round_id, status, kickoff_at')
      .in('round_id', roundIds)

    if (statsError) {
      res.status(500).json({ error: statsError.message })
      return
    }

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

    // 1) Markér runder som 'finished'
    const toMarkFinished = rounds.filter((r) => {
      const stat = statMap[r.id]
      return stat && stat.total > 0 && stat.finished === stat.total
    })
    const finishedIds = toMarkFinished.map((r) => r.id)
    if (finishedIds.length > 0) {
      await supabaseAdmin.from('rounds').update({ status: 'finished' }).in('id', finishedIds)
    }

    // Gruppér per sæson
    const roundsBySeason = new Map<number, RoundRow[]>()
    for (const r of typedAllRounds) {
      if (!roundsBySeason.has(r.season_id)) roundsBySeason.set(r.season_id, [])
      roundsBySeason.get(r.season_id)!.push(r)
    }

    // 2) Åbn næste upcoming runde per sæson
    const toMarkOpen = rounds.filter((r) => {
      if (r.status !== 'upcoming') return false
      if (finishedIds.includes(r.id)) return false
      const seasonRounds = roundsBySeason.get(r.season_id) ?? []
      const effectiveStatus = (rd: RoundRow) => finishedIds.includes(rd.id) ? 'finished' : rd.status
      const hasActiveRound = seasonRounds.some(
        (rd) => rd.id !== r.id && (effectiveStatus(rd) === 'open' || effectiveStatus(rd) === 'closed')
      )
      if (hasActiveRound) return false
      const idx = seasonRounds.findIndex((rd) => rd.id === r.id)
      if (idx > 0) {
        const prev = seasonRounds[idx - 1]
        if (effectiveStatus(prev) !== 'finished') return false
      }
      return true
    })
    const openIds = toMarkOpen.map((r) => r.id)
    if (openIds.length > 0) {
      await supabaseAdmin.from('rounds').update({ status: 'open' }).in('id', openIds)
    }

    // 3) Sæt betting_closes_at = første kamp kickoff (kun hvis ikke allerede sat)
    const toSetDeadline = rounds.filter((r) => {
      if (r.betting_closes_at) return false
      if (finishedIds.includes(r.id)) return false
      const stat = statMap[r.id]
      return stat && stat.minKickoff
    })
    for (const r of toSetDeadline) {
      const stat = statMap[r.id]
      await supabaseAdmin
        .from('rounds')
        .update({ betting_closes_at: stat!.minKickoff! })
        .eq('id', r.id)
        .is('betting_closes_at', null)
    }

    console.log(`[update-rounds] finished: ${finishedIds.length}, opened: ${openIds.length}, deadlines: ${toSetDeadline.length}`)

    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_rounds',
      status: finishedIds.length > 0 || openIds.length > 0 ? 'success' : 'info',
      message: `update-rounds: ${finishedIds.length} finished, ${openIds.length} opened, ${toSetDeadline.length} deadlines sat`,
      metadata: {
        rounds_marked_finished: finishedIds,
        rounds_marked_open: openIds,
        deadlines_set: toSetDeadline.map((r) => r.id),
      },
    })

    res.json({
      ok: true,
      timestamp: nowIso,
      rounds_marked_finished: finishedIds.length,
      rounds_marked_open: openIds.length,
      deadlines_set: toSetDeadline.length,
    })
  } catch (err) {
    console.error('[update-rounds]', err)
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /calculate-points ──────────────────────────────────────────────────

app.get('/calculate-points', async (_req, res) => {
  try {
    const { data: activeGames } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('status', 'active')

    const activeGameIds = (activeGames ?? []).map((g) => g.id as number)
    let processed = 0

    if (activeGameIds.length > 0) {
      const { data: betRounds } = await supabaseAdmin
        .from('bets')
        .select('round_id')
        .in('game_id', activeGameIds)

      const roundIds = [...new Set((betRounds ?? []).map((b) => b.round_id as number))]

      for (const roundId of roundIds) {
        const { data: matches } = await supabaseAdmin
          .from('matches')
          .select('id, status')
          .eq('round_id', roundId)

        const allFinished = matches?.every((m) => m.status === 'finished')
        if (!allFinished) continue

        await calculateRoundPoints(roundId)
        processed++
      }
    }

    const { updated } = await syncProfilesPoints()

    await supabaseAdmin.from('admin_logs').insert({
      type: 'calculate_points',
      status: processed > 0 ? 'success' : 'info',
      message: `calculate-points: ${processed} rounds processed, ${updated} profiles updated`,
      metadata: { rounds_processed: processed, profiles_updated: updated },
    })

    res.json({ ok: true, processed, profiles_updated: updated })
  } catch (err) {
    console.error('[calculate-points]', err)
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /send-reminders ────────────────────────────────────────────────────

app.get('/send-reminders', async (_req, res) => {
  try {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate) {
      res.json({ ok: true, sent: 0, message: 'VAPID keys not configured' })
      return
    }

    webpush.setVapidDetails('mailto:admin@bodegabets.dk', vapidPublic, vapidPrivate)

    const now = new Date()
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000)

    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, season_id, betting_closes_at')
      .neq('status', 'finished')
      .gt('betting_closes_at', now.toISOString())
      .lte('betting_closes_at', sixHoursLater.toISOString())

    if (!rounds?.length) {
      res.json({ ok: true, sent: 0, message: 'No upcoming deadlines' })
      return
    }

    let totalSent = 0
    let totalFailed = 0

    for (const round of rounds) {
      const hoursLeft = Math.round(
        (new Date(round.betting_closes_at!).getTime() - now.getTime()) / (1000 * 60 * 60)
      )

      const { data: gameSeasonRows } = await supabaseAdmin
        .from('game_seasons')
        .select('game_id')
        .eq('season_id', round.season_id)

      const gameIdsForSeason = (gameSeasonRows ?? []).map((g: { game_id: number }) => g.game_id)
      const { data: games } = gameIdsForSeason.length
        ? await supabaseAdmin.from('games').select('id, name').in('id', gameIdsForSeason)
        : { data: [] as { id: number; name: string }[] }

      if (!games?.length) continue

      for (const game of games) {
        const { data: members } = await supabaseAdmin
          .from('game_members')
          .select('user_id')
          .eq('game_id', game.id)

        if (!members?.length) continue
        const memberUserIds = members.map((m) => m.user_id)

        const { data: existingBets } = await supabaseAdmin
          .from('bets')
          .select('user_id')
          .eq('round_id', round.id)
          .in('user_id', memberUserIds)

        const betUserIds = new Set((existingBets ?? []).map((b) => b.user_id))
        const missingUserIds = memberUserIds.filter((uid) => !betUserIds.has(uid))
        if (!missingUserIds.length) continue

        const { data: subscriptions } = await supabaseAdmin
          .from('push_subscriptions')
          .select('subscription')
          .in('user_id', missingUserIds)

        if (!subscriptions?.length) continue

        const payload = JSON.stringify({
          title: '\u23F0 Bodega Bets',
          body: `Deadline om ${hoursLeft} timer \u2014 ${game.name} venter!`,
          url: `/games/${game.id}`,
        })

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              sub.subscription as webpush.PushSubscription,
              payload
            )
            totalSent++
          } catch (err: unknown) {
            totalFailed++
            if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
              await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', (sub.subscription as { endpoint: string }).endpoint)
            }
          }
        }
      }
    }

    await supabaseAdmin.from('admin_logs').insert({
      type: 'send_reminders',
      status: totalSent > 0 ? 'success' : 'info',
      message: `send-reminders: ${totalSent} sent, ${totalFailed} failed`,
      metadata: { sent: totalSent, failed: totalFailed, rounds: rounds.length },
    })

    res.json({ ok: true, sent: totalSent, failed: totalFailed })
  } catch (err) {
    console.error('[send-reminders]', err)
    res.status(500).json({ error: String(err) })
  }
})

// ─── Start server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[bodegabets-cron] listening on port ${PORT}`)

  const self = `http://localhost:${PORT}`
  const headers = { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` }

  const call = (name: string, path: string) =>
    fetch(`${self}${path}`, { headers })
      .then(r => r.json())
      .then(j => { console.log(`[cron] ${name}`, j); return j })
      .catch(e => { console.error(`[cron] ${name} failed`, e); throw e })

  // Hvert 5. minut — sync live scores
  cron.schedule('*/5 * * * *', async () => {
    const start = Date.now()
    try {
      const result = await call('sync-scores', '/sync-scores')
      await pingAdmin('sync-scores', Date.now() - start, 'success', `${(result as { updated?: number })?.updated ?? 0} updated`)
    } catch (err) {
      await pingAdmin('sync-scores', Date.now() - start, 'error', String(err))
    }
  })

  // Hvert 30. minut — sync fixtures
  cron.schedule('*/30 * * * *', async () => {
    const start = Date.now()
    try {
      const result = await call('sync-fixtures', '/sync-fixtures')
      const r = result as { leagues_synced?: number; matches_created?: number; matches_updated?: number }
      await pingAdmin('sync-fixtures', Date.now() - start, 'success', `${r?.leagues_synced ?? 0} leagues, ${r?.matches_created ?? 0} created, ${r?.matches_updated ?? 0} updated`)
    } catch (err) {
      await pingAdmin('sync-fixtures', Date.now() - start, 'error', String(err))
    }
  })

  // Dagligt 08:00 UTC — opdater rundes status
  cron.schedule('0 8 * * *', async () => {
    const start = Date.now()
    try {
      const result = await call('update-rounds', '/update-rounds')
      const r = result as { rounds_marked_finished?: number; rounds_marked_open?: number; deadlines_set?: number }
      await pingAdmin('update-rounds', Date.now() - start, 'success', `finished: ${r?.rounds_marked_finished ?? 0}, opened: ${r?.rounds_marked_open ?? 0}, deadlines: ${r?.deadlines_set ?? 0}`)
    } catch (err) {
      await pingAdmin('update-rounds', Date.now() - start, 'error', String(err))
    }
  })

  // Dagligt 10:00 UTC — send reminders
  cron.schedule('0 10 * * *', async () => {
    const start = Date.now()
    try {
      const result = await call('send-reminders', '/send-reminders')
      const r = result as { sent?: number; failed?: number }
      await pingAdmin('send-reminders', Date.now() - start, 'success', `${r?.sent ?? 0} sent, ${r?.failed ?? 0} failed`)
    } catch (err) {
      await pingAdmin('send-reminders', Date.now() - start, 'error', String(err))
    }
  })

  console.log('[bodegabets-cron] cron jobs scheduled')
})
