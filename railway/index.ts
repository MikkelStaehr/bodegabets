/**
 * Bodega Bets — Railway Cron Service
 *
 * Standalone Express server der kører cron jobs for Bodega Bets.
 * Erstatter Vercel cron (som kun tillader daglige jobs på Hobby).
 *
 * Endpoints:
 *   GET /sync-scores       — dynamisk polling (hvert min, hvert 5. min ved ro)
 *   GET /batch-sync        — hver 3. time (sync fixtures + resultater for alle ligaer)
 *   GET /update-rounds     — dagligt 07:00 (opdater runde-status)
 *   GET /update-bet-open   — dagligt 07:05 (opret round_members for åbne runder)
 *   GET /send-reminders    — dagligt 10:00 (send push-notifikationer)
 *   GET /calculate-points  — manuel fallback (catch-up håndteres af sync-scores)
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
import { updateBlockStatuses, evaluateFinishedBlocks } from '@/lib/evaluateBlocks'

const app = express()
app.use(express.json())
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

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
      status: 'success',
      message: `sync-scores: ${(result as Record<string, unknown>).updated ?? 0} updated`,
      metadata: result,
    })

    res.json({ ok: true, ...result })
  } catch (e) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
      status: 'error',
      message: `sync-scores failed: ${String(e)}`,
    })
    res.status(500).json({ ok: false, error: String(e) })
  }
})

// ─── GET /batch-sync ────────────────────────────────────────────────────────
// Opdaterer alle kampe med passeret kickoff på tværs af alle ligaer
// Kører hver 3. time via cron

app.get('/batch-sync', async (_req, res) => {
  try {
    const results = await runLeagueSync()

    const totals = results.reduce(
      (acc, r) => ({
        synced: acc.synced + r.synced,
        rounds_created: acc.rounds_created + r.rounds_created,
        matches_created: acc.matches_created + r.matches_created,
        matches_updated: acc.matches_updated + r.matches_updated,
      }),
      { synced: 0, rounds_created: 0, matches_created: 0, matches_updated: 0 }
    )

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
      status: 'success',
      message: `batch-sync: ${results.length} leagues, ${totals.matches_updated} updated`,
      metadata: { leagues_synced: results.length, ...totals },
    })

    res.json({ ok: true, ...totals })
  } catch (err) {
    console.error('[batch-sync]', err)
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

    if (!rounds.length) {
      res.json({ ok: true, timestamp: nowIso, finished: 0, opened: 0, message: 'Ingen aktive runder' })
      return
    }

    // Hent matches via round_id
    const roundIds = typedAllRounds.map((r) => r.id)

    const { data: matchRows, error: statsError } = await supabaseAdmin
      .from('matches')
      .select('round_id, status, kickoff_at:kickoff')
      .in('round_id', roundIds)

    if (statsError) {
      res.status(500).json({ error: statsError.message })
      return
    }

    type MatchRow = { round_id: number; status: string; kickoff_at: string | null }
    const statMap: Record<number, { total: number; finished: number; minKickoff: string | null }> = {}
    for (const m of (matchRows ?? []) as MatchRow[]) {
      const roundId = m.round_id
      if (!roundId) continue
      if (!statMap[roundId]) statMap[roundId] = { total: 0, finished: 0, minKickoff: null }
      statMap[roundId].total++
      if (m.status === 'finished') statMap[roundId].finished++
      if (m.kickoff_at) {
        if (!statMap[roundId].minKickoff || m.kickoff_at < statMap[roundId].minKickoff!) {
          statMap[roundId].minKickoff = m.kickoff_at
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

    // Gruppér per season (ikke league)
    const roundsBySeason = new Map<number, RoundRow[]>()
    for (const r of typedAllRounds) {
      if (!roundsBySeason.has(r.season_id)) roundsBySeason.set(r.season_id, [])
      roundsBySeason.get(r.season_id)!.push(r)
    }

    // 2) Åbn næste upcoming runde per season
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

    // 3) Sæt betting_closes_at
    const toSetDeadline = rounds.filter((r) => {
      if (r.betting_closes_at) return false
      if (finishedIds.includes(r.id)) return false
      const stat = statMap[r.id]
      return stat && stat.minKickoff
    })
    for (const r of toSetDeadline) {
      const stat = statMap[r.id]
      const deadline = new Date(new Date(stat.minKickoff!).getTime() - 60 * 60 * 1000).toISOString()
      await supabaseAdmin.from('rounds').update({ betting_closes_at: deadline }).eq('id', r.id)
    }

    console.log(`[update-rounds] ${nowIso} — finished: ${finishedIds.length}, opened: ${openIds.length}, deadlines set: ${toSetDeadline.length}`)

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
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

// ─── GET /update-bet-open ───────────────────────────────────────────────────

app.get('/update-bet-open', async (_req, res) => {
  try {
    const now = new Date()
    const nowIso = now.toISOString()

    // rounds.bet_open styres nu af syncMatchScores (per-kamp lås).
    // Denne endpoint opretter kun round_members for åbne runder.

    // Hent runder med bet_open = true (sat af syncMatchScores)
    const { data: openRounds, error: fetchError } = await supabaseAdmin
      .from('rounds')
      .select('id, season_id')
      .eq('bet_open', true)

    if (fetchError) {
      await supabaseAdmin.from('admin_logs').insert({
        type: 'update_bet_open',
        status: 'error',
        message: `Fetch open rounds failed: ${fetchError.message}`,
      })
      res.status(500).json({ error: fetchError.message })
      return
    }

    // Opret round_members med 1000 pt for alle spillere i relevante spilrum
    let roundMembersCreated = 0

    for (const round of openRounds ?? []) {
      const { data: gameSeasonRows } = await supabaseAdmin
        .from('game_seasons')
        .select('game_id')
        .eq('season_id', round.season_id)

      const gameIds = (gameSeasonRows ?? []).map((gs: { game_id: number }) => gs.game_id)
      if (gameIds.length === 0) continue

      const { data: members } = await supabaseAdmin
        .from('game_members')
        .select('user_id, game_id')
        .in('game_id', gameIds)

      for (const member of members ?? []) {
        await supabaseAdmin
          .from('round_members')
          .upsert(
            {
              user_id: member.user_id,
              round_id: round.id,
              game_id: member.game_id,
              betting_balance: 1000,
            },
            { onConflict: 'user_id,round_id,game_id' }
          )
        roundMembersCreated++
      }
    }

    const openRoundIds = (openRounds ?? []).map((r) => r.id)
    console.log(`[update-bet-open] ${nowIso} — ${openRoundIds.length} åbne runder, round_members created: ${roundMembersCreated}`)

    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_bet_open',
      status: 'success',
      message: `update-bet-open: ${openRoundIds.length} åbne runder, ${roundMembersCreated} round_members oprettet`,
      metadata: { open_round_ids: openRoundIds, round_members_created: roundMembersCreated, timestamp: nowIso },
    })

    res.json({ updated: true, timestamp: nowIso, open_rounds: openRoundIds.length, round_members_created: roundMembersCreated })
  } catch (err) {
    console.error('[update-bet-open]', err)
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
      // Find seasons tilknyttet aktive spil
      const { data: gameSeasonRows } = await supabaseAdmin
        .from('game_seasons')
        .select('season_id')
        .in('game_id', activeGameIds)

      const seasonIds = [...new Set((gameSeasonRows ?? []).map((gs) => gs.season_id as number))]

      if (seasonIds.length > 0) {
        // Find runder for disse seasons
        const { data: roundRows } = await supabaseAdmin
          .from('rounds')
          .select('id, season_id, name')
          .in('season_id', seasonIds)

        for (const round of roundRows ?? []) {
          // Tjek om mindst én kamp i denne runde er finished
          const { data: matches } = await supabaseAdmin
            .from('matches')
            .select('id, status')
            .eq('round_id', round.id)

          const anyFinished = matches?.some((m) => m.status === 'finished')
          if (!anyFinished) continue

          await calculateRoundPoints(round.id)
          processed++
        }

        // Opdater block-statuser og evaluer færdige blocks
        for (const sid of seasonIds) {
          await updateBlockStatuses(sid)
          await evaluateFinishedBlocks(sid)
        }
      }
    }

    const { updated } = await syncProfilesPoints()

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
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

      const gameIdsForLeague = (gameSeasonRows ?? []).map((g: { game_id: number }) => g.game_id)
      const { data: games } = gameIdsForLeague.length
        ? await supabaseAdmin.from('games').select('id, name').in('id', gameIdsForLeague)
        : { data: [] as { id: number; name: string }[] }

      if (!games?.length) continue

      for (const game of games) {
        const { data: members } = await supabaseAdmin
          .from('game_members')
          .select('user_id')
          .eq('game_id', game.id)

        if (!members?.length) continue
        const memberUserIds = members.map((m) => m.user_id)

        // Find matches for denne runde via round_id
        const { data: roundMatches } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('round_id', round.id)

        const matchIds = (roundMatches ?? []).map((m: { id: number }) => m.id)

        const { data: existingBets } = matchIds.length
          ? await supabaseAdmin
              .from('bets')
              .select('user_id')
              .in('match_id', matchIds)
              .in('user_id', memberUserIds)
          : { data: [] as { user_id: string }[] }

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
      type: 'cron_sync',
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

// ─── GET /admin/test-fetch (temporary) ─────────────────────────────────────

app.get('/admin/test-fetch', async (_req, res) => {
  const debug: Record<string, unknown> = { version: '2026-04-06-v4' }
  try {
    const pageRes = await fetch(
      'https://www.uci.org/competition-hub/2025-uci-worldtour/jxcBRgu0WBnnEnJNGgtMA',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      },
    )
    const html = await pageRes.text()
    debug.pageStatus = pageRes.status
    debug.pageUrl = pageRes.url
    debug.htmlLength = html.length

    // Find any data-component with data-props
    const allComponents = [...html.matchAll(/data-component="([^"]+)"\s+data-props="([^"]*)"/g)]
    debug.components = allComponents.map((m) => m[1])

    if (allComponents.length === 0) {
      res.json({ ok: false, step: 'parse-html', debug, bodyPreview: html.slice(0, 2000) })
      return
    }

    // Decode and parse each component's props
    const decode = (s: string) =>
      s
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")

    // Look for races/competitions in all components
    type Race = { name: string; dates: string; detailsLink: string }
    const races: Race[] = []
    const allProps: Record<string, unknown> = {}

    for (const m of allComponents) {
      const componentName = m[1]
      try {
        const props = JSON.parse(decode(m[2]))
        allProps[componentName] = Object.keys(props)

        // Search for race entries recursively
        const search = (obj: unknown, depth = 0): void => {
          if (depth > 5 || !obj || typeof obj !== 'object') return
          if (Array.isArray(obj)) {
            for (const item of obj) search(item, depth + 1)
            return
          }
          const rec = obj as Record<string, unknown>
          // Check if this object has a detailsLink with competition-details URL
          const detailsLink = rec.detailsLink as Record<string, string> | undefined
          if (detailsLink?.url?.includes('/competition-details/')) {
            races.push({
              name: (rec.name as string) ?? (detailsLink.title as string) ?? '?',
              dates: (rec.dates as string) ?? '',
              detailsLink: detailsLink.url,
            })
          }
          for (const v of Object.values(rec)) search(v, depth + 1)
        }
        search(props)
      } catch {
        allProps[componentName] = 'parse-error'
      }
    }

    res.json({
      ok: true,
      debug,
      componentProps: allProps,
      racesFound: races.length,
      races: races.slice(0, 20),
    })
  } catch (err) {
    console.error('[admin/test-fetch]', err)
    res.status(500).json({ ok: false, debug, error: String(err) })
  }
})

// ─── Start server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[bodegabets-cron] listening on port ${PORT}`)

  // ─── Internal cron scheduler ───────────────────────────────────────────
  const CRON_SECRET = process.env.CRON_SECRET!
  const BASE_URL = `http://localhost:${PORT}`

  async function callEndpoint(path: string) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      })
      const data = await res.json()
      console.log(`[cron] ${path}:`, data)
    } catch (err) {
      console.error(`[cron] ${path} failed:`, err)
    }
  }

  // Dynamisk polling — hvert minut
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date()
      const soon = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

      // Hent kun round_ids fra aktive spil
      const { data: activeGameSeasons } = await supabaseAdmin
        .from('game_seasons')
        .select('season_id, games!inner(status)')
        .eq('games.status', 'active')

      const activeSeasonIds = [...new Set((activeGameSeasons ?? []).map(gs => gs.season_id as number))]

      const { data: activeRounds } = await supabaseAdmin
        .from('rounds')
        .select('id')
        .in('season_id', activeSeasonIds.length > 0 ? activeSeasonIds : [0])

      const activeRoundIds = (activeRounds ?? []).map(r => r.id as number)
      if (activeRoundIds.length === 0) return

      // Tjek om der er live kampe i aktive spil
      const { data: liveMatches } = await supabaseAdmin
        .from('matches')
        .select('id')
        .in('status', ['live', 'halftime'])
        .in('round_id', activeRoundIds)
        .limit(1)

      // Tjek om der er kampe der starter inden for 30 min i aktive spil
      const { data: soonMatches } = await supabaseAdmin
        .from('matches')
        .select('id')
        .eq('status', 'scheduled')
        .lte('kickoff', soon)
        .gte('kickoff', now.toISOString())
        .in('round_id', activeRoundIds)
        .limit(1)

      // Tjek om der er kampe der er scheduled men kickoff er passeret (bør være live)
      const { data: startedMatches } = await supabaseAdmin
        .from('matches')
        .select('id')
        .eq('status', 'scheduled')
        .lt('kickoff', now.toISOString())
        .in('round_id', activeRoundIds)
        .limit(1)

      const hasLive = (liveMatches?.length ?? 0) > 0
      const hasSoon = (soonMatches?.length ?? 0) > 0
      const hasStarted = (startedMatches?.length ?? 0) > 0

      if (hasLive || hasSoon || hasStarted) {
        console.log(`[cron] Dynamic sync — live: ${hasLive}, soon: ${hasSoon}, started: ${hasStarted}`)
        await callEndpoint('/sync-scores')
      } else {
        const minute = now.getMinutes()
        if (minute % 5 === 0) {
          await callEndpoint('/sync-scores')
        }
      }
    } catch (err) {
      console.error('[cron] Dynamic polling fejl:', err)
    }
  })

  // Hver 3. time — batch sync af alle kampe
  cron.schedule('0 */3 * * *', () => callEndpoint('/batch-sync'))

  // Dagligt kl. 07:00 UTC — update rounds
  cron.schedule('0 7 * * *', () => callEndpoint('/update-rounds'))

  // Dagligt kl. 07:05 UTC — update bet-open (efter update-rounds)
  cron.schedule('5 7 * * *', () => callEndpoint('/update-bet-open'))

  // Dagligt kl. 10:00 UTC — send reminders
  cron.schedule('0 10 * * *', () => callEndpoint('/send-reminders'))

  console.log('[bodegabets-cron] cron jobs scheduled')
})
