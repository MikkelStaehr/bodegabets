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
 *   GET /calculate-points  — safety net (primær trigger er nu i syncMatchScores)
 *   GET /sync-cycling-startlists — hver 3. time (PCS startlister for upcoming løb)
 *   GET /sync-cycling-stage-times — dagligt 05:30 (PCS stage-startidspunkter)
 *   GET /refresh-cycling-riders — dagligt 03:00 (100 rytter-pages refresh til hold-skift)
 *   GET /discover-bold-seasons — ugentligt mandag 04:00 (auto-opret nye sæsoner)
 *   GET /football-archive-check — dagligt 08:10 (arkivér fodbold-gamerooms efter sidste runde)
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
import { calculateCyclingPoints, runCyclingPointsForAllGames, runCyclingPointsForStage, finalizeCyclingRaces } from '@/lib/calculateCyclingPoints'
import { syncCyclingResults } from '@/lib/syncCyclingResults'
import { syncCyclingStartlists } from '@/lib/syncCyclingStartlists'
import { syncCyclingStageTimes } from '@/lib/syncCyclingStageTimes'
import { refreshCyclingRiders } from '@/lib/refreshCyclingRiders'
import { discoverBoldSeasons } from '@/lib/discoverBoldSeasons'

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

/**
 * 🔥 On fire: vælg én tilfældig knockout-kamp pr. knockout-blok som "on fire"
 * (dobbelt odds på alle bets i kampen) når blokken er i spil. Idempotent —
 * vælger kun hvis blokken ikke allerede har en on-fire-kamp, og ændrer den
 * aldrig bagefter. Returnerer antal nyligt valgte.
 */
async function assignKnockoutOnFire(): Promise<number> {
  const { data: koMatches } = await supabaseAdmin
    .from('matches')
    .select('id, round_id, is_on_fire')
    .eq('is_knockout', true)
  if (!koMatches?.length) return 0

  const roundIds = [...new Set(koMatches.map((m) => m.round_id).filter((x): x is number => x != null))]
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, block_id, status')
    .in('id', roundIds)
  const roundById = new Map(
    (rounds ?? []).map((r) => [r.id as number, r as { id: number; block_id: number | null; status: string }])
  )

  type Blk = { matchIds: number[]; hasOnFire: boolean; inPlay: boolean }
  const blocks = new Map<number, Blk>()
  for (const m of koMatches) {
    const r = m.round_id != null ? roundById.get(m.round_id as number) : null
    const bid = r?.block_id ?? null
    if (bid == null) continue
    const blk = blocks.get(bid) ?? { matchIds: [], hasOnFire: false, inPlay: false }
    blk.matchIds.push(m.id as number)
    if ((m as { is_on_fire?: boolean }).is_on_fire) blk.hasOnFire = true
    // Blokken er "i spil" når mindst én af dens runder ikke længere er upcoming.
    if (r && r.status !== 'upcoming') blk.inPlay = true
    blocks.set(bid, blk)
  }

  let assigned = 0
  for (const [, blk] of blocks) {
    if (blk.hasOnFire || !blk.inPlay || blk.matchIds.length === 0) continue
    const pick = blk.matchIds[Math.floor(Math.random() * blk.matchIds.length)]
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ is_on_fire: true, is_on_fire_set_at: new Date().toISOString() })
      .eq('id', pick)
    if (!error) assigned++
  }
  return assigned
}

// ─── GET /update-rounds ─────────────────────────────────────────────────────

app.get('/update-rounds', async (_req, res) => {
  try {
    const now = new Date()
    const nowIso = now.toISOString()

    const { data: allRounds, error: roundsError } = await supabaseAdmin
      .from('rounds')
      .select('id, name, status, betting_closes_at, season_id, block_id')
      .order('id', { ascending: true })

    if (roundsError) {
      res.status(500).json({ error: roundsError.message })
      return
    }

    type RoundRow = { id: number; name: string; status: string; betting_closes_at: string | null; season_id: number; block_id: number | null }
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

    // Gruppér per season (ikke league) — sorteret KRONOLOGISK (første kickoff),
    // ikke efter id. Runde-id er ikke altid kronologisk: slutspillets åbningsdage
    // (fx 1/16 · 28. jun) blev oprettet efter de senere dage og har derfor højere
    // id, så en id-sortering ville lade den senere dag åbne først og blokere den
    // tidligere. For normale sæsoner (id == kronologi) ændrer dette intet.
    const roundSortKey = (r: RoundRow) =>
      statMap[r.id]?.minKickoff ?? r.betting_closes_at ?? String(r.id).padStart(12, '0')
    const roundsBySeason = new Map<number, RoundRow[]>()
    for (const r of typedAllRounds) {
      if (!roundsBySeason.has(r.season_id)) roundsBySeason.set(r.season_id, [])
      roundsBySeason.get(r.season_id)!.push(r)
    }
    for (const arr of roundsBySeason.values()) {
      arr.sort((a, b) => roundSortKey(a).localeCompare(roundSortKey(b)))
    }

    // Blok-rækkefølge (block_id → block_number), så en ny blok ikke åbner før
    // den forrige blok er spillet færdig (slutrunde-spil).
    const { data: blocksData } = await supabaseAdmin.from('blocks').select('id, block_number')
    const blockNumById = new Map<number, number>(
      ((blocksData ?? []) as Array<{ id: number; block_number: number }>).map((b) => [b.id, b.block_number])
    )

    // 2) Åbn næste upcoming runde per season
    //
    // SELVHELENDE sekventiel åbning: tidligere blokerede en runde den næste
    // indtil den var markeret 'finished' (alle kampe spillet). Hvis en runde
    // satte sig fast (en kamp blev udsat/aldrig færdig) stoppede hele kæden →
    // ingen åbne runder. Nu betragtes en runde KUN som blokerende mens dens
    // betting-deadline er i fremtiden. Når deadline er passeret, blokerer den
    // ikke længere — så næste runde åbner uanset om den forrige hænger fast.
    // (Displayet skjuler alligevel runder med passeret deadline.)
    const deadlinePassed = (rd: RoundRow) =>
      rd.betting_closes_at != null && new Date(rd.betting_closes_at).getTime() < now.getTime()
    const toMarkOpen = rounds.filter((r) => {
      if (r.status !== 'upcoming') return false
      if (finishedIds.includes(r.id)) return false
      const seasonRounds = roundsBySeason.get(r.season_id) ?? []
      const effectiveStatus = (rd: RoundRow) => finishedIds.includes(rd.id) ? 'finished' : rd.status
      // En runde blokerer kun hvis den er aktiv OG dens betting stadig er åben.
      const hasActiveRound = seasonRounds.some(
        (rd) => rd.id !== r.id
          && (effectiveStatus(rd) === 'open' || effectiveStatus(rd) === 'closed')
          && !deadlinePassed(rd)
      )
      if (hasActiveRound) return false
      const idx = seasonRounds.findIndex((rd) => rd.id === r.id)
      if (idx > 0) {
        const prev = seasonRounds[idx - 1]
        // Forrige runde må gerne åbne denne: enten færdig, ELLER dens betting
        // er lukket (deadline passeret) — så en fastlåst forrige ikke blokerer.
        if (effectiveStatus(prev) !== 'finished' && !deadlinePassed(prev)) return false
      }
      // BLOK-BEVIDST: en ny blok må ikke åbne før den FORRIGE blok er spillet
      // færdig. Uden dette åbnede næste bloks runde så snart denne bloks sidste
      // rundes deadline var passeret — selvom blokken ikke var afgjort endnu.
      const rBlockNum = r.block_id != null ? (blockNumById.get(r.block_id) ?? null) : null
      if (rBlockNum != null) {
        const earlierBlockUnfinished = seasonRounds.some((rd) => {
          const n = rd.block_id != null ? blockNumById.get(rd.block_id) : null
          return n != null && n < rBlockNum && effectiveStatus(rd) !== 'finished'
        })
        if (earlierBlockUnfinished) return false
      }
      return true
    })
    const openIds = toMarkOpen.map((r) => r.id)
    if (openIds.length > 0) {
      await supabaseAdmin.from('rounds').update({ status: 'open' }).in('id', openIds)
    }

    // 🔥 On fire: vælg én tilfældig knockout-kamp for hver knockout-blok der nu
    // er i spil (og som ikke allerede har en on-fire-kamp). Idempotent.
    const onFireAssigned = await assignKnockoutOnFire()

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

    console.log(`[update-rounds] ${nowIso} — finished: ${finishedIds.length}, opened: ${openIds.length}, deadlines set: ${toSetDeadline.length}, champ finished: ${champFinished}, on-fire: ${onFireAssigned}`)

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

    webpush.setVapidDetails('mailto:admin@bodega-bets.com', vapidPublic, vapidPrivate)

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

// ─── GET /cycling-archive-check ─────────────────────────────────────────────
// Auto-arkivér cycling gamerooms hvor sidste løb sluttede for 14+ dage siden.
// Sender også 7-dages varsel via push før arkivering.
//
// SQL migration (kør én gang i Supabase):
//   ALTER TABLE games ADD COLUMN IF NOT EXISTS archive_warning_sent_at timestamptz;

app.get('/cycling-archive-check', async (_req, res) => {
  try {
    const now = new Date()
    const ARCHIVE_DAYS = 14
    const WARNING_DAYS = 7
    const dayMs = 24 * 60 * 60 * 1000
    const archiveCutoff = new Date(now.getTime() - ARCHIVE_DAYS * dayMs)
    const warningCutoff = new Date(now.getTime() - WARNING_DAYS * dayMs)

    // 1) Find aktive cycling gamerooms
    const { data: activeGames } = await supabaseAdmin
      .from('games')
      .select('id, name, host_id, archive_warning_sent_at')
      .eq('sport', 'cycling')
      .eq('status', 'active')

    if (!activeGames?.length) {
      res.json({ ok: true, archived: 0, warned: 0 })
      return
    }

    let archived = 0
    let warned = 0

    // VAPID setup (genbruges)
    const vapidPublic = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    const pushReady = !!(vapidPublic && vapidPrivate)
    if (pushReady) webpush.setVapidDetails('mailto:admin@bodega-bets.com', vapidPublic!, vapidPrivate!)

    for (const game of activeGames) {
      // 2) Find alle races tilknyttet dette gameroom
      const { data: gameRaces } = await supabaseAdmin
        .from('cycling_game_races')
        .select('race_id')
        .eq('game_id', game.id)

      const raceIds = (gameRaces ?? []).map((gr) => gr.race_id as string)
      if (raceIds.length === 0) continue

      const { data: races } = await supabaseAdmin
        .from('cycling_races')
        .select('id, status, end_date, start_date')
        .in('id', raceIds)

      const allRaces = races ?? []
      const allFinished = allRaces.length > 0 && allRaces.every((r) => r.status === 'finished')
      if (!allFinished) continue

      // 3) Find seneste end_date (fallback til start_date for one_day races)
      const lastEndDate = allRaces
        .map((r) => (r.end_date as string | null) ?? (r.start_date as string | null))
        .filter((d): d is string => d != null)
        .sort()
        .pop()
      if (!lastEndDate) continue

      const lastEnd = new Date(lastEndDate)

      // 4) Auto-arkivér hvis 14+ dage er gået
      if (lastEnd <= archiveCutoff) {
        await supabaseAdmin
          .from('games')
          .update({ status: 'finished' })
          .eq('id', game.id)
        archived++

        // Notifikation til alle medlemmer
        if (pushReady) {
          const { data: members } = await supabaseAdmin
            .from('game_members')
            .select('user_id')
            .eq('game_id', game.id)

          const memberIds = (members ?? []).map((m) => m.user_id as string)
          if (memberIds.length > 0) {
            const { data: subs } = await supabaseAdmin
              .from('push_subscriptions')
              .select('subscription, endpoint')
              .in('user_id', memberIds)

            const payload = JSON.stringify({
              title: '🏁 Spilrum afsluttet',
              body: `${game.name} er arkiveret. Du kan stadig se historik og slut-placering.`,
              url: `/games/${game.id}`,
            })
            for (const s of subs ?? []) {
              try {
                await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload)
              } catch (e: unknown) {
                if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
                  await supabaseAdmin
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', (s.subscription as { endpoint: string }).endpoint)
                }
              }
            }
          }
        }
        continue
      }

      // 5) 7-dages varsel hvis vi ikke har sendt det endnu
      if (
        lastEnd <= warningCutoff &&
        !game.archive_warning_sent_at &&
        pushReady
      ) {
        const daysUntilArchive = Math.max(
          1,
          Math.ceil((lastEnd.getTime() + ARCHIVE_DAYS * dayMs - now.getTime()) / dayMs),
        )

        const { data: members } = await supabaseAdmin
          .from('game_members')
          .select('user_id')
          .eq('game_id', game.id)

        const memberIds = (members ?? []).map((m) => m.user_id as string)
        if (memberIds.length > 0) {
          const { data: subs } = await supabaseAdmin
            .from('push_subscriptions')
            .select('user_id, subscription')
            .in('user_id', memberIds)

          for (const s of subs ?? []) {
            const targetIsHost = (s.user_id as string) === game.host_id
            const body = targetIsHost
              ? `Sidste løb i ${game.name} er kørt. Vil du tilføje flere løb? Ellers arkiveres spilrummet om ${daysUntilArchive} dage.`
              : `${game.name} arkiveres om ${daysUntilArchive} dage med mindre der tilføjes flere løb.`

            try {
              await webpush.sendNotification(
                s.subscription as webpush.PushSubscription,
                JSON.stringify({
                  title: '⏳ Spilrum afsluttes snart',
                  body,
                  url: `/games/${game.id}`,
                }),
              )
            } catch (e: unknown) {
              if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
                await supabaseAdmin
                  .from('push_subscriptions')
                  .delete()
                  .eq('endpoint', (s.subscription as { endpoint: string }).endpoint)
              }
            }
          }
        }

        await supabaseAdmin
          .from('games')
          .update({ archive_warning_sent_at: now.toISOString() })
          .eq('id', game.id)
        warned++
      }
    }

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_archive',
      status: archived > 0 || warned > 0 ? 'success' : 'info',
      message: `cycling-archive-check: ${archived} arkiveret, ${warned} varslet`,
      metadata: { archived, warned },
    })

    res.json({ ok: true, archived, warned })
  } catch (err) {
    console.error('[cycling-archive-check]', err)
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /football-archive-check ────────────────────────────────────────────
// Auto-arkivér fodbold-gamerooms hvor sidste runde i sæsonen sluttede for
// 14+ dage siden. Sender 7-dages varsel via push før arkivering.
//
// Logikken spejler cycling-archive-check: vi tjekker game_seasons → seasons →
// rounds. Hvis ALLE runder for spillets season(er) er 'finished' og seneste
// kamp er > 14 dage gammel → arkivér game.
//
// Bruger samme archive_warning_sent_at felt som cykel.

app.get('/football-archive-check', async (_req, res) => {
  try {
    const now = new Date()
    const ARCHIVE_DAYS = 14
    const WARNING_DAYS = 7
    const dayMs = 24 * 60 * 60 * 1000
    const archiveCutoff = new Date(now.getTime() - ARCHIVE_DAYS * dayMs)
    const warningCutoff = new Date(now.getTime() - WARNING_DAYS * dayMs)

    const { data: activeGames } = await supabaseAdmin
      .from('games')
      .select('id, name, host_id, archive_warning_sent_at')
      .eq('sport', 'football')
      .eq('status', 'active')

    if (!activeGames?.length) {
      res.json({ ok: true, archived: 0, warned: 0 })
      return
    }

    let archived = 0
    let warned = 0

    const vapidPublic = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    const pushReady = !!(vapidPublic && vapidPrivate)
    if (pushReady) webpush.setVapidDetails('mailto:admin@bodega-bets.com', vapidPublic!, vapidPrivate!)

    for (const game of activeGames) {
      // 1) Find spillets sæson(er)
      const { data: gameSeasons } = await supabaseAdmin
        .from('game_seasons')
        .select('season_id')
        .eq('game_id', game.id)

      const seasonIds = (gameSeasons ?? []).map((gs) => gs.season_id as number)
      if (seasonIds.length === 0) continue

      // 2) Hent alle runder for sæsonen — alle skal være 'finished' for at arkivere
      const { data: rounds } = await supabaseAdmin
        .from('rounds')
        .select('id, status')
        .in('season_id', seasonIds)

      const allRounds = rounds ?? []
      if (allRounds.length === 0) continue
      const allFinished = allRounds.every((r) => r.status === 'finished')
      if (!allFinished) continue

      // 3) Find seneste kampdato — fallback til kickoff på en match
      const { data: latestMatch } = await supabaseAdmin
        .from('matches')
        .select('kickoff')
        .in('round_id', allRounds.map((r) => r.id))
        .order('kickoff', { ascending: false })
        .limit(1)

      const lastKickoff = latestMatch?.[0]?.kickoff as string | undefined
      if (!lastKickoff) continue
      const lastEnd = new Date(lastKickoff)

      // 4) Auto-arkivér hvis 14+ dage er gået
      if (lastEnd <= archiveCutoff) {
        await supabaseAdmin
          .from('games')
          .update({ status: 'finished' })
          .eq('id', game.id)
        archived++

        if (pushReady) {
          const { data: members } = await supabaseAdmin
            .from('game_members')
            .select('user_id')
            .eq('game_id', game.id)

          const memberIds = (members ?? []).map((m) => m.user_id as string)
          if (memberIds.length > 0) {
            const { data: subs } = await supabaseAdmin
              .from('push_subscriptions')
              .select('subscription, endpoint')
              .in('user_id', memberIds)

            const payload = JSON.stringify({
              title: '🏁 Sæson afsluttet',
              body: `${game.name} er arkiveret. Du kan stadig se historik og slut-placering.`,
              url: `/games/${game.id}`,
            })
            for (const s of subs ?? []) {
              try {
                await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload)
              } catch (e: unknown) {
                if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
                  await supabaseAdmin
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', (s.subscription as { endpoint: string }).endpoint)
                }
              }
            }
          }
        }
        continue
      }

      // 5) 7-dages varsel
      if (lastEnd <= warningCutoff && !game.archive_warning_sent_at && pushReady) {
        const daysUntilArchive = Math.max(
          1,
          Math.ceil((lastEnd.getTime() + ARCHIVE_DAYS * dayMs - now.getTime()) / dayMs),
        )

        const { data: members } = await supabaseAdmin
          .from('game_members')
          .select('user_id')
          .eq('game_id', game.id)

        const memberIds = (members ?? []).map((m) => m.user_id as string)
        if (memberIds.length > 0) {
          const { data: subs } = await supabaseAdmin
            .from('push_subscriptions')
            .select('user_id, subscription')
            .in('user_id', memberIds)

          for (const s of subs ?? []) {
            const targetIsHost = (s.user_id as string) === game.host_id
            const body = targetIsHost
              ? `Sidste runde i ${game.name} er kørt. Tilføj næste sæson via 'Tilføj sæson' — ellers arkiveres spilrummet om ${daysUntilArchive} dage.`
              : `${game.name} arkiveres om ${daysUntilArchive} dage med mindre værten tilføjer næste sæson.`

            try {
              await webpush.sendNotification(
                s.subscription as webpush.PushSubscription,
                JSON.stringify({
                  title: '⏳ Spilrum afsluttes snart',
                  body,
                  url: `/games/${game.id}`,
                }),
              )
            } catch (e: unknown) {
              if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
                await supabaseAdmin
                  .from('push_subscriptions')
                  .delete()
                  .eq('endpoint', (s.subscription as { endpoint: string }).endpoint)
              }
            }
          }
        }

        await supabaseAdmin
          .from('games')
          .update({ archive_warning_sent_at: now.toISOString() })
          .eq('id', game.id)
        warned++
      }
    }

    await supabaseAdmin.from('admin_logs').insert({
      type: 'football_archive',
      status: archived > 0 || warned > 0 ? 'success' : 'info',
      message: `football-archive-check: ${archived} arkiveret, ${warned} varslet`,
      metadata: { archived, warned },
    })

    res.json({ ok: true, archived, warned })
  } catch (err) {
    console.error('[football-archive-check]', err)
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
      // Smart default: hvis tiden er præcis 00:00:00 UTC (PCS gemte kun datoen),
      // brug 13:00 UTC (~15:00 CEST) som typisk cykel-start-tid.
      const startRaw = new Date(stage.start_date)
      if (
        startRaw.getUTCHours() === 0 &&
        startRaw.getUTCMinutes() === 0 &&
        startRaw.getUTCSeconds() === 0
      ) {
        startRaw.setUTCHours(13, 0, 0, 0)
      }
      const deadline = new Date(startRaw.getTime() - 30 * 60 * 1000)
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

// ─── GET /sync-cycling-startlists ───────────────────────────────────────────
// Synkroniserer startlister for upcoming/active cykel-løb fra PCS.
// Kører dagligt — PCS opdaterer manuelt op til løbsstart, så daglig
// re-sync sikrer at lineup-builder altid har seneste roster.

app.get('/sync-cycling-startlists', async (_req, res) => {
  try {
    const result = await syncCyclingStartlists()

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_startlists_sync',
      status: result.ok ? 'success' : 'error',
      message: `sync-cycling-startlists: ${result.racesProcessed} races, ${result.entriesUpserted} entries, ${result.unmatched} unmatched`,
      metadata: result as unknown as Record<string, unknown>,
    })

    res.json({ ok: result.ok, ...result })
  } catch (err) {
    console.error('[sync-cycling-startlists]', err)
    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_startlists_sync',
      status: 'error',
      message: `sync-cycling-startlists failed: ${String(err)}`,
    })
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /sync-cycling-stage-times ─────────────────────────────────────────
// Scrape PCS for hver upcoming stage's nøjagtige starttidspunkt og opdater
// cycling_stages.start_time_utc. Lineup-deadline beregnes som start - 30 min,
// så det er kritisk at vi har den faktiske tid (typisk 11:15-14:00 CEST)
// frem for vores 13:00 UTC default.

app.get('/sync-cycling-stage-times', async (_req, res) => {
  try {
    const result = await syncCyclingStageTimes()

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_stage_times_sync',
      status: result.ok ? 'success' : 'error',
      message: `sync-cycling-stage-times: ${result.stagesScanned} scannet, ${result.stagesUpdated} opdateret`,
      metadata: result as unknown as Record<string, unknown>,
    })

    res.json({ ok: result.ok, ...result })
  } catch (err) {
    console.error('[sync-cycling-stage-times]', err)
    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_stage_times_sync',
      status: 'error',
      message: `sync-cycling-stage-times failed: ${String(err)}`,
    })
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /discover-bold-seasons ────────────────────────────────────────────
// Ugentlig scan af Bold for nye sæsoner. Når Bold offentliggør fx Premier
// League 26/27 (typisk juni-juli) bliver en ny season-row automatisk oprettet
// så den dukker op i game-creation UI uden manuel intervention.

// Discovery sweeper Bold's phase-frontier og kan tage flere minutter. Vi svarer
// derfor med det samme (202) og kører scanningen i baggrunden — Railway-appen er
// en persistent Node-proces, så promise'et kører færdigt. Resultatet logges til
// admin_logs når det er færdigt.
app.get('/discover-bold-seasons', (_req, res) => {
  res.status(202).json({ ok: true, started: true })

  discoverBoldSeasons()
    .then(async (result) => {
      const insertedCount = result.candidates.filter((c) => c.inserted).length
      await supabaseAdmin.from('admin_logs').insert({
        type: 'bold_seasons_discover',
        status: result.ok ? 'success' : 'error',
        message: `discover-bold-seasons: ${insertedCount} ny(e) sæsoner oprettet (${result.scanned} phase-id'er scannet)`,
        metadata: result as unknown as Record<string, unknown>,
      })
    })
    .catch(async (err) => {
      console.error('[discover-bold-seasons]', err)
      await supabaseAdmin.from('admin_logs').insert({
        type: 'bold_seasons_discover',
        status: 'error',
        message: `discover-bold-seasons failed: ${String(err)}`,
      })
    })
})

// ─── GET /refresh-cycling-riders ───────────────────────────────────────────
// Daglig batch-refresh af cycling_riders master-data fra PCS rider-pages.
// Fanger hold-skift, foto-opdateringer og lignende der ikke ses af startlist-
// eller results-sync. 100 ryttere pr. run, ældste last_synced_at først.
// Hele DB'en gennemgås på ~10 dage hvilket er fint — hold-skift sker sjældent
// og er ikke kritiske at fange indenfor minutter.

app.get('/refresh-cycling-riders', async (_req, res) => {
  try {
    const result = await refreshCyclingRiders()

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_riders_refresh',
      status: result.ok ? 'success' : 'error',
      message: `refresh-cycling-riders: ${result.scanned} scannet, ${result.changed} opdateret (${result.teamChanges} hold-skift)`,
      metadata: result as unknown as Record<string, unknown>,
    })

    res.json({ ok: result.ok, ...result })
  } catch (err) {
    console.error('[refresh-cycling-riders]', err)
    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_riders_refresh',
      status: 'error',
      message: `refresh-cycling-riders failed: ${String(err)}`,
    })
    res.status(500).json({ error: String(err) })
  }
})

// ─── GET /sync-cycling-results ──────────────────────────────────────────────
// Henter etape-resultater fra PCS for aktive stage races og upserter dem til
// cycling_results. Trigger derefter automatisk runCyclingPointsForStage for
// hver nyligt synket etape.

app.get('/sync-cycling-results', async (_req, res) => {
  try {
    const result = await syncCyclingResults()

    // Trigger points-beregning for hver nyligt synket stage
    const pointsErrors: string[] = []
    for (const stageId of result.syncedStageIds) {
      try {
        await runCyclingPointsForStage(stageId)
      } catch (err) {
        pointsErrors.push(`stage ${stageId}: ${err}`)
      }
    }

    if (result.syncedStageIds.length > 0) {
      console.log(`[sync-cycling-results] Beregnet point for ${result.syncedStageIds.length} nye stages`)
    }

    // Markér stage races som 'finished' når alle deres etaper har resultater
    // (også løb der hænger fast — fx grand tours der aldrig blev flippet).
    const racesFinalized = await finalizeCyclingRaces()
    if (racesFinalized > 0) console.log(`[sync-cycling-results] Finaliserede ${racesFinalized} løb`)

    res.json({
      ok: result.ok && pointsErrors.length === 0,
      stagesProcessed: result.stagesProcessed,
      resultsUpserted: result.resultsUpserted,
      unmatched: result.unmatched,
      syncedStages: result.syncedStageIds.length,
      errors: [...result.errors, ...pointsErrors],
    })
  } catch (err) {
    console.error('[sync-cycling-results]', err)
    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_results_sync',
      status: 'error',
      message: `sync-cycling-results failed: ${String(err)}`,
    })
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
    // Safety net: process kun stages med results_uploaded_at indenfor de
    // sidste 7 dage. Den primære trigger ligger nu i /sync-cycling-results
    // umiddelbart efter upload, så denne endpoint er kun til at fange
    // edge-cases (fx Railway restart midt under sync). Tidligere processede
    // den ALLE finished stages hver 30. min = ~2400 spildte recalcs/dag.
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: stages } = await supabaseAdmin
      .from('cycling_stages')
      .select('id, stage_number, race_id, cycling_races!inner(name)')
      .gte('results_uploaded_at', cutoff)
      .order('stage_number')

    const stageRows = (stages ?? []) as unknown as Array<{
      id: string
      stage_number: number
      race_id: string
      cycling_races: { name: string }
    }>

    const processed: { race: string; stage: number }[] = []
    const raceNames = new Set<string>()
    for (const s of stageRows) {
      console.log(`[cycling-points] Beregner ${s.cycling_races.name} stage ${s.stage_number}...`)
      await runCyclingPointsForStage(s.id)
      processed.push({ race: s.cycling_races.name, stage: s.stage_number })
      raceNames.add(s.cycling_races.name)
    }

    // Backwards-compat: bulk-fallback for finished one-day races der ikke
    // har stage-niveau timestamp (legacy data)
    const { data: finishedRaces } = await supabaseAdmin
      .from('cycling_races')
      .select('id, name')
      .eq('status', 'finished')
    for (const race of finishedRaces ?? []) {
      if (!raceNames.has(race.name)) {
        await runCyclingPointsForAllGames(race.id)
        processed.push({ race: race.name, stage: 0 })
      }
    }

    await supabaseAdmin.from('admin_logs').insert({
      type: 'cycling_points',
      status: processed.length > 0 ? 'success' : 'info',
      message: `cycling-points: ${processed.length} stages beregnet`,
      metadata: { processed },
    })

    res.json({ ok: true, processed: processed.length, items: processed })
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
      const minute = now.getMinutes()

      // INGEN tidsbaseret nattepause: VM 2026 spilles i USA, så kampene kører
      // hen over den danske nat (typisk 02:00–05:00 UTC / 04:00–07:00 DK). En
      // fast pause 00:00–11:00 UTC sprang live-sync over for de kampe og
      // fastfrøs dem midt i halvlegen. Match-tjekkene nedenfor afgør selv
      // frekvensen — hvert minut når en kamp er live/begyndt, hvert 30. minut
      // når der intet er — så cost ved at køre 24/7 er minimal (lette,
      // indekserede limit-1 opslag).

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

  // Hvert 15. minut — update rounds (åbn/luk/finish + deadlines).
  // TIDLIGERE kørte den kun dagligt kl. 07:00, men det var for sjældent: en
  // rundes betting-vindue er [forrige rundes deadline → egen deadline], og
  // hvis det vindue lå mellem to daglige kørsler (fx en VM-dag med tidlig
  // kamp) blev runden aldrig åbnet i tide og fik intet betting-vindue. Den
  // selvhelende opener åbner næste runde så snart den forriges deadline
  // passerer — men kun hvis cron'en rent faktisk kører i det vindue.
  cron.schedule('*/15 * * * *', () => callEndpoint('/update-rounds'))

  // Dagligt kl. 07:05 UTC — update bet-open (efter update-rounds)
  cron.schedule('5 7 * * *', () => callEndpoint('/update-bet-open'))

  // Dagligt kl. 10:00 UTC — send reminders
  cron.schedule('0 10 * * *', () => callEndpoint('/send-reminders'))

  // Hvert 30. minut, DØGNET RUNDT — safety net for point-beregning (primær trigger er i
  // syncMatchScores når en kamp flipper til finished). Fanger edge-cases som manglende
  // match-events OG sene resultat-rettelser (en rettelse re-trigger ikke scoring i sync).
  // 24/7 fordi VM 2026 spilles i USA: natkampe afsluttes ~06:00 UTC og skal re-scores straks
  // — det gamle 11-23-vindue lod natresultater sidde un-rescoret indtil kl. 11. syncMatchScores
  // er allerede 24/7 af samme grund.
  cron.schedule('*/30 * * * *', () => callEndpoint('/calculate-points'))

  // Hvert 15. minut — lås cycling lineups (kun 09:00–20:00 UTC / 10:00–21:00 DK)
  cron.schedule('*/15 9-20 * * *', () => callEndpoint('/cycling-lock-lineups'))

  // Hver 30. min fra 14:00–22:30 UTC (16:00–00:30 DK) — pull etape-resultater
  // fra PCS. Etaper slutter typisk 14:30–17:30 UTC, så 30-min cadence sikrer
  // at brugere får point indenfor ~30 min af målgang i stedet for op til en
  // time. Sync trigger derefter automatisk runCyclingPointsForStage internt.
  cron.schedule('*/30 14-22 * * *', () => callEndpoint('/sync-cycling-results'))

  // Hver 2. time — beregn cykling-point safety net (kun 14-22 UTC,
  // umiddelbart efter sync-cycling-results). Primær trigger ligger nu
  // inline i /sync-cycling-results og kører straks pr. ny etape, så
  // dette behøver ikke køre hyppigt — kun fange edge-cases hvor sync
  // crashed mellem upload og points-calc.
  cron.schedule('30 14-22/2 * * *', () => callEndpoint('/cycling-points'))

  // Dagligt kl. 08:00 UTC — auto-arkivér cycling gamerooms efter sidste løb
  cron.schedule('0 8 * * *', () => callEndpoint('/cycling-archive-check'))

  // Dagligt kl. 08:10 UTC — auto-arkivér fodbold-gamerooms efter sidste runde
  // i sæsonen (14+ dage efter sidste kamp). Værten får 7-dages varsel.
  cron.schedule('10 8 * * *', () => callEndpoint('/football-archive-check'))

  // Ugentligt mandag kl. 04:00 UTC — scan Bold for nye sæsoner. Nye phase_ids
  // dukker op uregelmæssigt (Premier League ~juni, La Liga ~juli osv.), så
  // én scan om ugen er rigeligt. Auto-opretter season-row med suggested name
  // baseret på første kampdato.
  cron.schedule('0 4 * * 1', () => callEndpoint('/discover-bold-seasons'))

  // Dagligt kl. 03:00 UTC — refresh batch af cycling_riders master-data
  // fra PCS. 100 ryttere/dag, hele DB (~930) gennemgås på ~10 dage. Fanger
  // hold-skift, foto-opdateringer, manglende team_logo osv. Kører om natten
  // hvor der ikke er anden trafik.
  cron.schedule('0 3 * * *', () => callEndpoint('/refresh-cycling-riders'))

  // Dagligt kl. 05:30 UTC — scrape PCS for hver upcoming stage's nøjagtige
  // starttidspunkt. Lineup-deadline beregnes som start - 30 min, så det er
  // kritisk at have rigtig tid frem for vores 13:00 UTC default. PCS opdaterer
  // sjældent tider efter første publicering, så daglig sync er nok.
  cron.schedule('30 5 * * *', () => callEndpoint('/sync-cycling-stage-times'))

  // Hver 3. time — pull startlister fra PCS for upcoming/active løb.
  // PCS opdaterer rosters helt op til løbsstart (fx Pogačar trukket fra
  // Dauphiné 7. juni morgen), så 1x daglig var for sjældent. 8x daglig
  // sikrer at lineup-builder har seneste version indenfor 3 timer af
  // PCS-update. Belastning på PCS er minimal: ~3-6 upcoming races × 1 sek
  // delay = ~6-12 sek pr. sync run.
  cron.schedule('0 */3 * * *', () => callEndpoint('/sync-cycling-startlists'))

  console.log('[bodegabets-cron] cron jobs scheduled')
})
