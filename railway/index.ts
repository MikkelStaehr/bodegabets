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
import { calculateRoundPoints, calculateChampionshipRoundPoints, syncProfilesPoints } from '@/lib/calculatePoints'
import { updateBlockStatuses, evaluateFinishedBlocks } from '@/lib/evaluateBlocks'
import { calculateCyclingPoints, runCyclingPointsForAllGames, runCyclingPointsForStage } from '@/lib/calculateCyclingPoints'

const app = express()
app.use(express.json())
const PORT = parseInt(process.env.PORT ?? '3000', 10)

// Fang unhandled errors så containeren ikke silent crasher
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err)
})

// ─── Supabase admin client ──────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Public endpoints (no auth) — health checks ────────────────────────────

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'bodegabets-cron' })
})

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
    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
      status: 'error',
      message: `batch-sync failed: ${String(err)}`,
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

    // 4) Markér championship_rounds som finished
    const { data: champRounds } = await supabaseAdmin
      .from('championship_rounds')
      .select(`
        id,
        championship_round_matches(
          matches(id, status)
        )
      `)
      .eq('status', 'upcoming')

    let champFinished = 0
    for (const cr of champRounds ?? []) {
      const allChampMatches = (cr.championship_round_matches as { matches: { id: number; status: string }[] }[])
        .flatMap((crm) => crm.matches ?? [])
      if (allChampMatches.length > 0 && allChampMatches.every((m) => m.status === 'finished')) {
        await supabaseAdmin
          .from('championship_rounds')
          .update({ status: 'finished' })
          .eq('id', cr.id)
        champFinished++
      }
    }

    console.log(`[update-rounds] ${nowIso} — finished: ${finishedIds.length}, opened: ${openIds.length}, deadlines set: ${toSetDeadline.length}, champ finished: ${champFinished}`)

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
      status: finishedIds.length > 0 || openIds.length > 0 ? 'success' : 'info',
      message: `update-rounds: ${finishedIds.length} finished, ${openIds.length} opened, ${toSetDeadline.length} deadlines sat, ${champFinished} champ finished`,
      metadata: {
        rounds_marked_finished: finishedIds,
        rounds_marked_open: openIds,
        deadlines_set: toSetDeadline.map((r) => r.id),
        championship_rounds_finished: champFinished,
      },
    })

    res.json({
      ok: true,
      timestamp: nowIso,
      rounds_marked_finished: finishedIds.length,
      rounds_marked_open: openIds.length,
      deadlines_set: toSetDeadline.length,
      championship_rounds_finished: champFinished,
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

    // Championship rounds — beregn for alle aktive championship_mode games
    let champProcessed = 0
    const { data: champGames } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('status', 'active')
      .eq('championship_mode', true)

    if (champGames && champGames.length > 0) {
      // Find alle ikke-færdige championship rounds med mindst én finished kamp
      const { data: champRounds } = await supabaseAdmin
        .from('championship_rounds')
        .select(`
          id,
          championship_round_matches(
            match_id,
            matches(id, status)
          )
        `)
        .neq('status', 'finished')

      for (const cr of champRounds ?? []) {
        const crMatches = (cr.championship_round_matches as unknown as { matches: { id: number; status: string } | null }[])
          .map((crm) => crm.matches)
          .filter((m): m is { id: number; status: string } => m !== null)
        const anyFinished = crMatches.some((m) => m.status === 'finished')
        if (!anyFinished) continue

        await calculateChampionshipRoundPoints(cr.id)
        champProcessed++
      }
    }

    const { updated } = await syncProfilesPoints()

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cron_sync',
      status: (processed > 0 || champProcessed > 0) ? 'success' : 'info',
      message: `calculate-points: ${processed} rounds + ${champProcessed} championship rounds, ${updated} profiles`,
      metadata: { rounds_processed: processed, championship_processed: champProcessed, profiles_updated: updated },
    })

    res.json({ ok: true, processed, championship_processed: champProcessed, profiles_updated: updated })
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

// ─── POST /api/cycling/calculate-points ─────────────────────────────────────

app.post('/api/cycling/calculate-points', async (req, res) => {
  try {
    const { race_id, stage_id, game_id } = req.body as { race_id?: string; stage_id?: string; game_id?: number }

    // Stage-based: beregn for én specifik etape
    if (stage_id) {
      await runCyclingPointsForStage(stage_id)
      const { count } = await supabaseAdmin
        .from('cycling_scores')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stage_id)
      res.json({ ok: true, scores_calculated: count ?? 0 })
      return
    }

    // Race-based: beregn for alle etaper i et løb
    if (!race_id) {
      res.status(400).json({ error: 'race_id eller stage_id er påkrævet' })
      return
    }

    await runCyclingPointsForAllGames(race_id)

    const { count } = await supabaseAdmin
      .from('cycling_scores')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', race_id)

    res.json({ ok: true, scores_calculated: count ?? 0 })
  } catch (err) {
    console.error('[cycling/calculate-points]', err)
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /cycling-lock-lineups ──────────────────────────────────────────────
// Lås cycling lineups hvor deadline er passeret

app.get('/cycling-lock-lineups', async (_req, res) => {
  try {
    const now = new Date()
    let lockedCount = 0

    // Lås kun lineups hvor stage start_date - 30 min er passeret.
    // Block-deadline bruges IKKE — det er for bredt (dækker hele blokken med flere løb).
    const { data: allUnlocked } = await supabaseAdmin
      .from('cycling_lineups')
      .select('id, stage_id, cycling_stages!inner(start_date)')
      .eq('is_locked', false)

    for (const lineup of allUnlocked ?? []) {
      const stage = lineup.cycling_stages as unknown as { start_date: string }
      if (!stage?.start_date) continue
      const deadline = new Date(new Date(stage.start_date).getTime() - 30 * 60 * 1000)
      if (deadline < now) {
        await supabaseAdmin.from('cycling_lineups').update({ is_locked: true }).eq('id', lineup.id)
        lockedCount++
      }
    }

    if (lockedCount > 0) {
      console.log(`[cycling-lock] Låste ${lockedCount} lineups`)
      await supabaseAdmin.from('admin_logs').insert({
        type: 'cycling_lock',
        status: 'success',
        message: `cycling-lock: ${lockedCount} lineups låst`,
      })
    }

    res.json({ ok: true, locked: lockedCount })
  } catch (err) {
    console.error('[cycling-lock]', err)
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /cycling-points ────────────────────────────────────────────────────
// Finder cykling-løb der netop er skiftet til 'finished' og beregner point
/*
  SQL — kør manuelt i Supabase:

  ALTER TABLE cycling_races
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER cycling_races_updated_at
  BEFORE UPDATE ON cycling_races
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
*/

app.get('/cycling-points', async (_req, res) => {
  try {
    // Find alle finished cycling races — beregning er idempotent (upsert)
    // så det er OK at køre den for alle finished races hver gang
    const { data: finishedRaces } = await supabaseAdmin
      .from('cycling_races')
      .select('id, name')
      .eq('status', 'finished')

    const processed: string[] = []

    for (const race of finishedRaces ?? []) {
      console.log(`[cycling-points] Beregner point for ${race.name}...`)
      await runCyclingPointsForAllGames(race.id)
      processed.push(race.name)
    }

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_points',
      status: processed.length > 0 ? 'success' : 'info',
      message: `cycling-points: ${processed.length} løb beregnet`,
      metadata: { races: processed },
    })

    res.json({ ok: true, processed: processed.length, races: processed })
  } catch (err) {
    console.error('[cycling-points]', err)
    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_points',
      status: 'error',
      message: `cycling-points failed: ${String(err)}`,
    })
    res.status(500).json({ error: String(err) })
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

  // ─── Intelligent polling ─────────────────────────────────────────────
  //
  // Fodbold polling: 11:00–00:00 UTC (12:00–01:00 DK)
  //   → Live/started kampe: sync hvert minut
  //   → Kampe inden 30 min: sync hvert 2. minut
  //   → Idle: sync hvert 30. minut
  //   → 00:00–11:00 UTC: OFF (ingen kampe)
  //
  // Cykling cron: 09:00–20:00 UTC (10:00–21:00 DK)
  //   → Lock: hvert 15. minut
  //   → Points: hvert 30. minut
  //   → 20:00–09:00 UTC: OFF (ingen løb)

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date()
      const utcHour = now.getUTCHours()
      const minute = now.getMinutes()

      // ── Nattepause: 00:00–11:00 UTC (01:00–12:00 DK) — ingen fodboldkampe ──
      if (utcHour >= 0 && utcHour < 11) return

      const soon = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

      // ── Quick check: er der overhovedet aktive spil? ───────────────
      const { data: activeGames } = await supabaseAdmin
        .from('games')
        .select('id, championship_mode')
        .eq('status', 'active')
        .limit(1)

      if (!activeGames?.length) return // ingen aktive spil, skip alt

      // ── Hent relevante match IDs ──────────────────────────────────
      // Regular games
      const { data: activeGameSeasons } = await supabaseAdmin
        .from('game_seasons')
        .select('season_id, games!inner(status)')
        .eq('games.status', 'active')

      const activeSeasonIds = [...new Set((activeGameSeasons ?? []).map(gs => gs.season_id as number))]

      let activeRoundIds: number[] = []
      if (activeSeasonIds.length > 0) {
        const { data: activeRounds } = await supabaseAdmin
          .from('rounds')
          .select('id')
          .in('season_id', activeSeasonIds)
        activeRoundIds = (activeRounds ?? []).map(r => r.id as number)
      }

      // Championship games
      let champMatchIds: number[] = []
      const { data: champGames } = await supabaseAdmin
        .from('games')
        .select('id')
        .eq('status', 'active')
        .eq('championship_mode', true)

      if (champGames && champGames.length > 0) {
        const { data: champRoundMatches } = await supabaseAdmin
          .from('championship_round_matches')
          .select('match_id, championship_rounds!inner(id, status)')
          .neq('championship_rounds.status', 'finished')

        champMatchIds = (champRoundMatches ?? []).map(crm => crm.match_id as number)
      }

      if (activeRoundIds.length === 0 && champMatchIds.length === 0) return

      // ── Tjek match-tilstand ───────────────────────────────────────
      let hasLive = false
      let hasSoon = false
      let hasStarted = false

      // Regular rounds
      if (activeRoundIds.length > 0) {
        const { data: liveMatches } = await supabaseAdmin
          .from('matches').select('id')
          .in('status', ['live', 'halftime'])
          .in('round_id', activeRoundIds).limit(1)
        if (liveMatches?.length) hasLive = true

        if (!hasLive) {
          const { data: soonMatches } = await supabaseAdmin
            .from('matches').select('id')
            .eq('status', 'scheduled').lte('kickoff', soon).gte('kickoff', now.toISOString())
            .in('round_id', activeRoundIds).limit(1)
          if (soonMatches?.length) hasSoon = true
        }

        if (!hasStarted) {
          const { data: startedMatches } = await supabaseAdmin
            .from('matches').select('id')
            .eq('status', 'scheduled').lt('kickoff', now.toISOString())
            .in('round_id', activeRoundIds).limit(1)
          if (startedMatches?.length) hasStarted = true
        }
      }

      // Championship rounds
      if (champMatchIds.length > 0) {
        if (!hasLive) {
          const { data } = await supabaseAdmin.from('matches').select('id')
            .in('status', ['live', 'halftime']).in('id', champMatchIds).limit(1)
          if (data?.length) hasLive = true
        }
        if (!hasSoon) {
          const { data } = await supabaseAdmin.from('matches').select('id')
            .eq('status', 'scheduled').lte('kickoff', soon).gte('kickoff', now.toISOString())
            .in('id', champMatchIds).limit(1)
          if (data?.length) hasSoon = true
        }
        if (!hasStarted) {
          const { data } = await supabaseAdmin.from('matches').select('id')
            .eq('status', 'scheduled').lt('kickoff', now.toISOString())
            .in('id', champMatchIds).limit(1)
          if (data?.length) hasStarted = true
        }
      }

      // ── Beslut sync-frekvens ──────────────────────────────────────
      if (hasLive || hasStarted) {
        // Real-time: sync hvert minut
        await callEndpoint('/sync-scores')
      } else if (hasSoon) {
        // Kampe snart: sync hvert 2. minut
        if (minute % 2 === 0) await callEndpoint('/sync-scores')
      } else {
        // Idle: sync hvert 30. minut
        if (minute % 30 === 0) await callEndpoint('/sync-scores')
      }
    } catch (err) {
      console.error('[cron] Dynamic polling fejl:', err)
    }
  })

  // ─── Faste cron jobs ────────────────────────────────────────────────

  // Hver 3. time — batch sync af alle kampe
  cron.schedule('0 */3 * * *', () => callEndpoint('/batch-sync'))

  // Dagligt kl. 07:00 UTC — update rounds
  cron.schedule('0 7 * * *', () => callEndpoint('/update-rounds'))

  // Dagligt kl. 07:05 UTC — update bet-open (efter update-rounds)
  cron.schedule('5 7 * * *', () => callEndpoint('/update-bet-open'))

  // Dagligt kl. 10:00 UTC — send reminders
  cron.schedule('0 10 * * *', () => callEndpoint('/send-reminders'))

  // Hvert 10. minut — beregn fodbold + championship point (kun 11:00–00:00 UTC)
  cron.schedule('*/10 11-23 * * *', () => callEndpoint('/calculate-points'))

  // Hvert 15. minut — lås cycling lineups (kun 09:00–20:00 UTC / 10:00–21:00 DK)
  cron.schedule('*/15 9-20 * * *', () => callEndpoint('/cycling-lock-lineups'))

  // Hvert 30. minut — beregn cykling-point (kun 09:00–20:00 UTC)
  cron.schedule('*/30 9-20 * * *', () => callEndpoint('/cycling-points'))

  console.log('[bodegabets-cron] cron jobs scheduled')
})
