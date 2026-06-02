import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { getEffectiveSquadRidersForSquads } from '@/lib/cyclingTransfers'
import CyclingBlockStanding from '@/components/cycling/CyclingBlockStanding'
import { findActiveSubBlock, shortSubBlockName } from '@/lib/cyclingBlocks'
import { GameStateProvider } from '@/hooks/useGameState'
import GameTicker from '@/components/games/GameTicker'
import ActiveRoundLiveTicker from '@/components/games/ActiveRoundLiveTicker'
import InviteCodeShare from '@/components/games/InviteCodeShare'
import CalendarSlider from '@/components/games/CalendarSlider'
import type { CalendarMatch, CalendarRound } from '@/components/games/CalendarSlider'
import CyclingCalendarSlider from '@/components/games/CyclingCalendarSlider'
import type { CyclingEvent } from '@/components/games/CyclingCalendarSlider'
import ActiveRounds from '@/components/games/ActiveRounds'
import { formatDateTime } from '@/lib/dateUtils'
import type { ActiveRoundRow } from '@/components/games/ActiveRounds'
import type { Game, Round, RoundScore } from '@/types'
import LineupBuilder from '@/components/cycling/LineupBuilder'
import CyclingGameroom from '@/components/cycling/CyclingGameroom'
import RolesGuide from '@/components/cycling/RolesGuide'
import Leaderboard from '@/components/games/Leaderboard'
import FootballLiveSection from '@/components/games/FootballLiveSection'
import FreeEventPitchBanner from '@/components/games/FreeEventPitchBanner'
import NavbarSportTheme from '@/components/layout/NavbarSportTheme'
import { getGameState } from '@/lib/gameState'
import { getSportTheme, assignRanks, computeRoundStatus, getLeagueAbbr, getCurrentChampionshipSeason } from '@/lib/gamePageHelpers'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

type MemberRow = {
  user_id: string
  earnings: number
  profile: { username: string } | null
}

type RoundScoreMap = Record<string, Record<number, number>>

export default async function GamePage({ params }: Props) {
  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hent game
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name, host_id, invite_code, status, created_at, sport, championship_mode')
    .eq('id', gameId)
    .single()

  if (!game) notFound()

  // Hent brugerens subscription-status og om spillet er bundet til en
  // free-event sæson — bruges til at vise tryout-pitch-banner.
  const [{ data: viewerProfile }, { data: freeEventSeasonRow }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('game_seasons')
      .select('seasons!inner(is_free_event)')
      .eq('game_id', gameId)
      .eq('seasons.is_free_event', true)
      .limit(1)
      .maybeSingle(),
  ])
  const viewerIsPaying =
    viewerProfile?.subscription_status === 'active' ||
    viewerProfile?.subscription_status === 'comped'
  const gameIsFreeEvent = freeEventSeasonRow != null

  // Hent season_ids fra game_seasons
  const { data: gameSeasons } = await supabase
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)
  const seasonIds = (gameSeasons ?? []).map(gs => gs.season_id as number)

  const [
    { data: rawMembers },
    { data: rounds },
    { data: roundScores },
    { data: myMembership },
    { data: profile },
    { data: latestFinishedRoundByStatus },
    { data: blocks },
  ] = await Promise.all([
    supabaseAdmin
      .from('game_members')
      .select('user_id, earnings, profile:profiles(username)')
      .eq('game_id', gameId)
      .order('earnings', { ascending: false }),

    seasonIds.length > 0
      ? supabaseAdmin
          .from('rounds')
          .select('id, name, status, betting_closes_at, season_id, bet_open, block_id')
          .in('season_id', seasonIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),

    supabase
      .from('round_scores')
      .select('user_id, round_id, points_earned, earnings_delta')
      .eq('game_id', gameId),

    supabaseAdmin
      .from('game_members')
      .select('user_id')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle(),

    supabase
      .from('profiles')
      .select('username, points, is_admin')
      .eq('id', user.id)
      .single(),

    seasonIds.length > 0
      ? supabase
          .from('rounds')
          .select('id, name, season_id')
          .in('season_id', seasonIds)
          .eq('status', 'finished')
          .order('betting_closes_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    seasonIds.length > 0
      ? supabase
          .from('blocks')
          .select('id, season_id, block_number, name, status')
          .in('season_id', seasonIds)
      : Promise.resolve({ data: [] as { id: number; season_id: number; block_number: number; name: string; status: string }[] }),
  ])

  if (!myMembership) redirect('/dashboard')

  const typedRoundsEarly = (rounds ?? []) as Round[]

  // Hent liga-info via seasons → tournaments
  const uniqueSeasonIds = [...new Set(typedRoundsEarly.map((r) => r.season_id).filter(Boolean))]
  const { data: seasonTournaments } =
    uniqueSeasonIds.length > 0
      ? await supabase
          .from('seasons')
          .select('id, tournament_id, tournaments:tournament_id(id, name, logo_url)')
          .in('id', uniqueSeasonIds)
      : { data: [] as { id: number; tournament_id: number; tournaments: { id: number; name: string; logo_url: string | null } }[] }
  const seasonLeagueMap = new Map<number, { abbr: string; type: 'league' | 'cup'; logo_url: string | null }>()
  for (const s of seasonTournaments ?? []) {
    const t = s.tournaments as unknown as { id: number; name: string; logo_url: string | null } | null
    if (t) seasonLeagueMap.set(s.id, { ...getLeagueAbbr(t.name), logo_url: t.logo_url ?? null })
  }
  const defaultLeagueInfo = seasonLeagueMap.values().next().value ?? { abbr: '??', type: 'league' as const }

  const activeRoundEarly =
    typedRoundsEarly.find((r) => r.bet_open === true) ?? null
  const latestFinishedRound = (latestFinishedRoundByStatus as { id: number; name: string; season_id: number } | null) ?? null

  const [{ data: recentMatches }, { data: activeRoundMatches }] = await Promise.all([
    latestFinishedRound
      ? supabase
          .from('matches')
          .select(`
            home_score, away_score, kickoff_at:kickoff,
            home_team:teams!home_team_id(name),
            away_team:teams!away_team_id(name)
          `)
          .eq('round_id', latestFinishedRound.id)
          .not('home_score', 'is', null)
          .order('kickoff', { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] }),

    activeRoundEarly
      ? supabaseAdmin
          .from('matches')
          .select('id')
          .eq('round_id', activeRoundEarly.id)
      : Promise.resolve({ data: [] }),
  ])

  // Bets har ikke round_id — hent via match_ids
  const activeMatchIds = (activeRoundMatches ?? []).map((m: { id: number }) => m.id)
  const { data: roundBets } =
    activeMatchIds.length > 0
      ? await supabaseAdmin
          .from('bets')
          .select('id, user_id')
          .eq('game_id', gameId)
          .in('match_id', activeMatchIds)
      : { data: [] as { id: number; user_id: string }[] }

  // ── Achievements til leaderboard ────────────────────────────────────────────
  const ACHIEVEMENT_PRIORITY = [
    'maskinen', 'oraklet', 'analytikeren', 'hattrick', 'blokkongen',
    'comebacket', 'bundskraberen', 'trofast', 'veteranen', 'all_in',
    'detaljeorienteret', 'clean_sheet_fan', 'måljægeren', 'gætteren',
    'spareblussen', 'blindskud',
  ]

  const { data: userAchievementsRaw } = await supabase
    .from('user_achievements')
    .select('user_id, achievement_key')
    .eq('game_id', gameId)

  const achievementKeys = [...new Set((userAchievementsRaw ?? []).map(a => a.achievement_key as string))]
  const { data: achievementDefs } = achievementKeys.length > 0
    ? await supabase
        .from('achievements')
        .select('key, name, icon')
        .in('key', achievementKeys)
    : { data: [] as { key: string; name: string; icon: string }[] }

  const achievementDefMap = new Map((achievementDefs ?? []).map(a => [a.key, a]))

  // Per bruger: find det achievement med højest prioritet (lavest index)
  const bestKeyPerUser = new Map<string, { key: string; priority: number }>()
  for (const ua of userAchievementsRaw ?? []) {
    const key = ua.achievement_key as string
    const userId = ua.user_id as string
    const priority = ACHIEVEMENT_PRIORITY.indexOf(key)
    if (priority === -1) continue
    const current = bestKeyPerUser.get(userId)
    if (!current || priority < current.priority) {
      bestKeyPerUser.set(userId, { key, priority })
    }
  }
  const achievementMap = new Map<string, { icon: string; name: string }>()
  for (const [userId, { key }] of bestKeyPerUser) {
    const def = achievementDefMap.get(key)
    if (def) achievementMap.set(userId, { icon: def.icon, name: def.name })
  }

  const typedGame = game as Game
  const theme = getSportTheme(typedGame.sport)

  // Fetch cycling schedule for cycling games
  let cyclingEvents: CyclingEvent[] = []
  if (typedGame.sport === 'cycling') {
    const { data: gameRaces } = await supabaseAdmin
      .from('cycling_game_races')
      .select('race_id, block_number')
      .eq('game_id', gameId)

    if (gameRaces?.length) {
      const raceIds = gameRaces.map((gr) => gr.race_id)
      const blockByRace = new Map(gameRaces.map((gr) => [gr.race_id, gr.block_number]))

      const [{ data: cRaces }, { data: cStages }] = await Promise.all([
        supabaseAdmin
          .from('cycling_races')
          .select('id, name, pcs_slug, race_type, profile, start_date, status')
          .in('id', raceIds),
        supabaseAdmin
          .from('cycling_stages')
          .select('id, race_id, stage_number, name, profile, start_date, results_uploaded_at')
          .in('race_id', raceIds.filter((id) => {
            // We'll filter stage_race ids after we have races, but fetch all stages for now
            return true
          }))
          .order('stage_number', { ascending: true }),
      ])

      const raceById = new Map((cRaces ?? []).map((r) => [r.id, r]))

      for (const race of cRaces ?? []) {
        if (race.race_type === 'one_day') {
          cyclingEvents.push({
            date: race.start_date,
            race_name: race.name,
            race_slug: race.pcs_slug,
            race_type: race.race_type,
            stage_number: null,
            stage_name: null,
            profile: race.profile,
            status: race.status,
            block_number: blockByRace.get(race.id) ?? 0,
          })
        }
      }

      const cyclingNow = new Date()
      for (const stage of cStages ?? []) {
        const race = raceById.get(stage.race_id)
        if (!race || race.race_type !== 'stage_race') continue
        // Per-stage status — race.status alene gjorde alle 21 etaper i en
        // active Grand Tour til 'Aktiv'. Tjek results_uploaded_at + start_date.
        const stageStart = new Date(stage.start_date)
        let stageStatus: string
        if (stage.results_uploaded_at) stageStatus = 'finished'
        else if (stageStart > cyclingNow) stageStatus = 'upcoming'
        else stageStatus = 'active'
        cyclingEvents.push({
          date: stage.start_date,
          race_name: race.name,
          race_slug: race.pcs_slug,
          race_type: race.race_type,
          stage_number: stage.stage_number,
          stage_name: stage.name,
          profile: stage.profile || race.profile,
          status: stageStatus,
          block_number: blockByRace.get(race.id) ?? 0,
        })
      }

      cyclingEvents.sort((a, b) => a.date.localeCompare(b.date))
    }
  }

  // Lineup builder data — brugerens squads + løb
  let userSquad: { id: string } | null = null
  let lineupRaces: { id: string; name: string; start_date: string; status: string; race_type: string; profile: string | null; profile_image_url: string | null; logo_url: string | null; race_photo_url: string | null; rest_days: string[] | null; cycling_block_id: string | null }[] = []
  let lineupSquadRiders: { id: string; first_name: string; last_name: string; team_name: string; category: number; team_logo_url: string | null; photo_url: string | null }[] = []
  let cyclingActiveBlock: { id: string; name: string; block_order: number; lock_deadline?: string | null } | null = null
  // Visnings-navn for aktiv blok: aktiv sub-blok (uge) hvis findes, ellers top-blokken.
  let cyclingActiveBlockDisplayName: string | null = null
  // Status på den vist-blok (kan være sub-blok). Styrer "Fører" vs "Vinder"-label i CyclingBlockStanding.
  let cyclingActiveBlockStatus: 'upcoming' | 'active' | 'finished' | null = null
  let cyclingBlocks: { id: string; name: string; block_order: number; parent_block_id: string | null; lock_deadline: string; status?: string; winner_username?: string | null; winner_user_id?: string | null; stage_number_min?: number | null; stage_number_max?: number | null }[] = []
  let lineupStages: { id: string; race_id: string; stage_number: number; name: string; profile: string | null; profile_image_url: string | null; start_date: string; distance_km: number | null; departure: string | null; arrival: string | null; profile_score: number | null; vertical_meters: number | null; results_uploaded_at: string | null; race_name: string; race_type: string; race_profile_image_url: string | null; cycling_block_id: string | null }[] = []
  let lineupStartlists: Record<string, string[]> = {}
  // raceId → riderId → abandon_type (DNF, DNS, OTL, DSQ)
  const lineupAbandoned: Record<string, Record<string, string>> = {}
  // raceId → riderId → { jersey, gc_position }. Snapshot fra seneste stage
  // med data. Bruges i lineup-picker til trøje + GC top-N badges + sort.
  const lineupStandings: Record<string, Record<string, { jersey: string | null; gc_position: number | null }>> = {}
  // raceId → klassement-snapshot med rytter-info (til gameroom-display)
  type ClassementRider = {
    rider_id: string
    first_name: string
    last_name: string
    team_name: string
    photo_url: string | null
    team_logo_url: string | null
    position: number
    time_gap_seconds?: number | null  // GC: gap til leder | Youth: gap til ung-leder
    points?: number | null            // Points: total point-score | Mountain: KOM-point
  }
  const lineupClassements: Record<string, {
    raceName: string
    leader: ClassementRider | null
    pointsLeader: ClassementRider | null
    mountainLeader: ClassementRider | null
    youthLeader: ClassementRider | null
    gcTop: ClassementRider[]       // top 10 incl. time_gap_seconds
    pointsTop: ClassementRider[]   // top 10
    mountainTop: ClassementRider[] // top 10
    youthTop: ClassementRider[]    // top 10
  }> = {}
  let blockSquadMap: Record<string, string> = {}

  if (typedGame.sport === 'cycling') {
    // Hent ALLE squads for brugeren i dette game
    const { data: userSquads } = await supabaseAdmin
      .from('cycling_squads')
      .select('id, cycling_block_id')
      .eq('game_id', gameId)
      .eq('user_id', user.id)

    // Byg blockSquadMap: block_id → squad_id
    for (const sq of userSquads ?? []) {
      const blockId = (sq as { cycling_block_id?: string | null }).cycling_block_id
      if (blockId) blockSquadMap[blockId] = sq.id
    }

    // Brug første squad som userSquad (for CyclingGameroom backward compat)
    userSquad = (userSquads ?? [])[0] ?? null

    // Find brugerens aktive blok (fra første squad med cycling_block_id)
    const cyclingBlockId = (userSquads ?? []).map((sq) => (sq as { cycling_block_id?: string | null }).cycling_block_id).find((id) => id) ?? null

    if (cyclingBlockId) {
      const { data: fetchedBlock } = await supabaseAdmin
        .from('cycling_blocks')
        .select('id, name, block_order, lock_deadline, parent_block_id')
        .eq('id', cyclingBlockId)
        .single()

      if (fetchedBlock) {
        cyclingActiveBlock = fetchedBlock
        cyclingActiveBlockDisplayName = fetchedBlock.name
      }
    }

    // Hent alle blokke for gameroom (inkl. status for tab-rendering)
    const { data: blocksData } = await supabaseAdmin
      .from('cycling_blocks')
      .select('id, name, block_order, parent_block_id, lock_deadline, status, stage_number_min, stage_number_max')
      .eq('game_id', gameId)
      .order('block_order', { ascending: true })

    cyclingBlocks = (blocksData ?? []) as typeof cyclingBlocks

    // Find aktiv SUB-blok (uge) under cyclingActiveBlock — bruges som overskrift
    // på per-blok stillingen, så vi viser "Giro Uge X — stilling" i stedet for
    // "Giro d'Italia — stilling". Hvis top-blokken ikke har sub-blokke (fx en
    // klassiker-blok), falder vi tilbage til top-blokkens navn.
    if (cyclingActiveBlock) {
      // Default: brug top-blokkens status hvis ingen sub-blok findes
      const topBlock = cyclingBlocks.find((b) => b.id === cyclingActiveBlock!.id)
      cyclingActiveBlockStatus = (topBlock?.status as typeof cyclingActiveBlockStatus) ?? null

      const subs = cyclingBlocks.filter((b) => b.parent_block_id === cyclingActiveBlock.id)
      if (subs.length > 0) {
        const { data: gr } = await supabaseAdmin
          .from('cycling_game_races')
          .select('race_id')
          .eq('game_id', gameId)
          .eq('cycling_block_id', cyclingActiveBlock.id)
        const raceIdsForActive = (gr ?? []).map((r) => r.race_id as string)
        if (raceIdsForActive.length > 0) {
          const { data: stagesForActive } = await supabaseAdmin
            .from('cycling_stages')
            .select('stage_number, results_uploaded_at')
            .in('race_id', raceIdsForActive)
          const active = findActiveSubBlock(subs, stagesForActive ?? [])
          if (active) {
            cyclingActiveBlockDisplayName = shortSubBlockName(active.name)
            cyclingActiveBlockStatus = (active.status as typeof cyclingActiveBlockStatus) ?? null
          }
        }
      }
    }

    // Beregn vinder for hver finished block (top point summe på tværs af blokkens stages)
    const finishedBlockIds = cyclingBlocks
      .filter((b) => b.status === 'finished' && b.parent_block_id === null)
      .map((b) => b.id)
    if (finishedBlockIds.length > 0) {
      const { data: finishedRaceLinks } = await supabaseAdmin
        .from('cycling_game_races')
        .select('race_id, cycling_block_id')
        .eq('game_id', gameId)
        .in('cycling_block_id', finishedBlockIds)

      const raceToBlock = new Map<string, string>()
      for (const l of finishedRaceLinks ?? []) {
        if (l.cycling_block_id) raceToBlock.set(l.race_id as string, l.cycling_block_id as string)
      }

      const { data: scoresData } = await supabaseAdmin
        .from('cycling_scores')
        .select('race_id, total_points, cycling_lineups!inner(cycling_squads!inner(user_id, game_id))')
        .eq('cycling_lineups.cycling_squads.game_id', gameId)
        .in('race_id', [...raceToBlock.keys()])

      // Aggregér points per (block, user)
      const blockUserPoints = new Map<string, Map<string, number>>()
      for (const s of scoresData ?? []) {
        const userId = ((s.cycling_lineups as unknown as { cycling_squads: { user_id: string } })?.cycling_squads?.user_id) as string
        const bid = raceToBlock.get(s.race_id as string)
        if (!userId || !bid) continue
        if (!blockUserPoints.has(bid)) blockUserPoints.set(bid, new Map())
        const userMap = blockUserPoints.get(bid)!
        userMap.set(userId, (userMap.get(userId) ?? 0) + (Number(s.total_points) || 0))
      }

      // Hent usernames for de unikke user_ids
      const allUserIds = [...new Set(
        [...blockUserPoints.values()].flatMap((m) => [...m.keys()])
      )]
      const userNameMap = new Map<string, string>()
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, username')
          .in('id', allUserIds)
        for (const p of profiles ?? []) userNameMap.set(p.id as string, p.username as string)
      }

      for (const block of cyclingBlocks) {
        const userMap = blockUserPoints.get(block.id)
        if (!userMap || userMap.size === 0) continue
        let topUid: string | null = null
        let topPts = -Infinity
        for (const [uid, pts] of userMap) {
          if (pts > topPts) { topPts = pts; topUid = uid }
        }
        if (topUid && topPts > 0) {
          block.winner_user_id = topUid
          block.winner_username = userNameMap.get(topUid) ?? null
        }
      }
    }

    // Hent alle løb for gameroom (filtrering sker client-side via blok-tabs)
    const { data: gameRacesFull } = await supabaseAdmin
      .from('cycling_game_races')
      .select('race_id, cycling_block_id, cycling_races!inner(id, name, start_date, status, race_type, profile, profile_image_url, logo_url, race_photo_url, rest_days)')
      .eq('game_id', gameId)

    lineupRaces = (gameRacesFull ?? [])
      .map((gr) => {
        const race = gr.cycling_races as unknown as { id: string; name: string; start_date: string; status: string; race_type: string; profile: string | null; profile_image_url: string | null; logo_url: string | null; race_photo_url: string | null; rest_days: string[] | null }
        return { ...race, cycling_block_id: gr.cycling_block_id as string | null }
      })

    // Hent stages for alle løb i spillet
    const raceIdsForStages = lineupRaces.map((r) => r.id)
    if (raceIdsForStages.length > 0) {
      const { data: stagesData } = await supabaseAdmin
        .from('cycling_stages')
        .select('id, race_id, stage_number, name, profile, profile_image_url, start_date, distance_km, departure, arrival, profile_score, vertical_meters, results_uploaded_at')
        .in('race_id', raceIdsForStages)
        .order('start_date', { ascending: true })

      lineupStages = (stagesData ?? []).map((s) => {
        const race = lineupRaces.find((r) => r.id === s.race_id)
        return {
          ...s,
          race_name: race?.name ?? '',
          race_type: race?.race_type ?? 'one_day',
          race_profile_image_url: race?.profile_image_url ?? null,
          cycling_block_id: race?.cycling_block_id ?? null,
        }
      })

      // Hent startlister for alle løb (til lineup info)
      const { data: startlistData } = await supabaseAdmin
        .from('cycling_startlists')
        .select('race_id, rider_id')
        .in('race_id', raceIdsForStages)

      for (const row of startlistData ?? []) {
        if (!lineupStartlists[row.race_id]) lineupStartlists[row.race_id] = []
        lineupStartlists[row.race_id].push(row.rider_id)
      }

      // Hent DNF/DNS-ryttere — i et stage race er en DNF permanent for resten
      // af løbet, så de skal disables i pickeren for kommende etaper.
      const { data: dnfData } = await supabaseAdmin
        .from('cycling_results')
        .select('race_id, rider_id, abandon_type')
        .in('race_id', raceIdsForStages)
        .eq('dnf', true)
      for (const row of dnfData ?? []) {
        if (!lineupAbandoned[row.race_id]) lineupAbandoned[row.race_id] = {}
        lineupAbandoned[row.race_id][row.rider_id] = row.abandon_type ?? 'DNF'
      }

      // Hent klassement-felter pr. stage pr. rytter. gc_gap_seconds og
      // youth_gap_seconds er scraped direkte fra PCS' klassifikations-tabel
      // og afspejler officielle GC-/youth-gaps inkl. bonus-sekunder.
      type StandingsRow = {
        race_id: string
        rider_id: string
        jersey: string | null
        gc_position_after: number | null
        points_position_after: number | null
        mountain_position_after: number | null
        youth_position_after: number | null
        points_value: number | null
        mountain_value: number | null
        gc_gap_seconds: number | null
        youth_gap_seconds: number | null
        stage_number: number
        dnf: boolean
      }
      // Paginér — uden dette afkorter Supabase til 1000 rækker, hvilket giver
      // ufuldstændige klassementer (manglende ryttere → forkert trøjebærer).
      const standingsData: StandingsRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data: page } = await supabaseAdmin
          .from('cycling_results')
          .select('race_id, rider_id, jersey, gc_position_after, points_position_after, mountain_position_after, youth_position_after, points_value, mountain_value, gc_gap_seconds, youth_gap_seconds, stage_number, dnf')
          .in('race_id', raceIdsForStages)
          .range(from, from + 999)
        if (!page?.length) break
        standingsData.push(...(page as StandingsRow[]))
        if (page.length < 1000) break
      }
      // Aggreger: latestByKey[race::rider] = klassement-data, per-felt seneste-
      // ikke-null. Hvis stage 5's sync fejler for fx youth, falder vi tilbage
      // til stage 4's youth-data så Christen ikke "forsvinder" fra Bianca-tabellen.
      // En klassifikation-værdi opdateres kun hvis nyere stage faktisk har data
      // (ikke null) for det felt.
      type LatestEntry = {
        jersey: string | null
        gc_position: number | null
        points_position: number | null
        mountain_position: number | null
        youth_position: number | null
        points_value: number | null
        mountain_value: number | null
        gc_gap_seconds: number | null
        youth_gap_seconds: number | null
        gcStage: number
        pointsStage: number
        mountainStage: number
        youthStage: number
        dnfEver: boolean
      }
      const latestByKey = new Map<string, LatestEntry>()
      const ensure = (key: string): LatestEntry => {
        let e = latestByKey.get(key)
        if (!e) {
          e = {
            jersey: null,
            gc_position: null, points_position: null, mountain_position: null, youth_position: null,
            points_value: null, mountain_value: null,
            gc_gap_seconds: null, youth_gap_seconds: null,
            gcStage: 0, pointsStage: 0, mountainStage: 0, youthStage: 0,
            dnfEver: false,
          }
          latestByKey.set(key, e)
        }
        return e
      }
      for (const row of standingsData) {
        const key = `${row.race_id}::${row.rider_id}`
        const e = ensure(key)
        if (row.dnf) e.dnfEver = true
        // Per-klassifikation: opdater kun hvis denne række har ikke-null data
        // og er fra et stage senere end den allerede gemte værdi.
        if (row.gc_position_after != null && row.stage_number > e.gcStage) {
          e.gc_position = row.gc_position_after
          e.gc_gap_seconds = row.gc_gap_seconds
          e.gcStage = row.stage_number
        }
        if (row.points_position_after != null && row.stage_number > e.pointsStage) {
          e.points_position = row.points_position_after
          e.points_value = row.points_value
          e.pointsStage = row.stage_number
        }
        if (row.mountain_position_after != null && row.stage_number > e.mountainStage) {
          e.mountain_position = row.mountain_position_after
          e.mountain_value = row.mountain_value
          e.mountainStage = row.stage_number
        }
        if (row.youth_position_after != null && row.stage_number > e.youthStage) {
          e.youth_position = row.youth_position_after
          e.youth_gap_seconds = row.youth_gap_seconds
          e.youthStage = row.stage_number
        }
        // Jersey: tag den seneste ikke-null pr. rytter
        if (row.jersey != null) {
          const maxStage = Math.max(e.gcStage, e.pointsStage, e.mountainStage, e.youthStage)
          if (row.stage_number >= maxStage) e.jersey = row.jersey
        }
      }
      for (const [key, info] of latestByKey) {
        const [raceId, riderId] = key.split('::')
        if (!lineupStandings[raceId]) lineupStandings[raceId] = {}
        lineupStandings[raceId][riderId] = { jersey: info.jersey, gc_position: info.gc_position }
      }

      // Find alle rytter-IDs der har data i top-10 af nogen klassifikation
      const classementRiderIds = new Set<string>()
      for (const [key, info] of latestByKey) {
        if (info.dnfEver) continue
        if (info.gc_position != null && info.gc_position <= 10) classementRiderIds.add(key.split('::')[1])
        if (info.points_position != null && info.points_position <= 10) classementRiderIds.add(key.split('::')[1])
        if (info.mountain_position != null && info.mountain_position <= 10) classementRiderIds.add(key.split('::')[1])
        if (info.youth_position != null && info.youth_position <= 10) classementRiderIds.add(key.split('::')[1])
      }
      let riderInfoMap = new Map<string, {
        rider_id: string; first_name: string; last_name: string
        team_name: string; photo_url: string | null; team_logo_url: string | null
      }>()
      if (classementRiderIds.size > 0) {
        const { data: classementRidersData } = await supabaseAdmin
          .from('cycling_riders')
          .select('id, first_name, last_name, team_name, photo_url, team_logo_url')
          .in('id', [...classementRiderIds])
        type CycRider = {
          id: string; first_name: string; last_name: string
          team_name: string; photo_url: string | null; team_logo_url: string | null
        }
        riderInfoMap = new Map((classementRidersData ?? []).map((r) => {
          const rider = r as CycRider
          return [rider.id, {
            rider_id: rider.id,
            first_name: rider.first_name,
            last_name: rider.last_name,
            team_name: rider.team_name,
            photo_url: rider.photo_url,
            team_logo_url: rider.team_logo_url,
          }]
        }))
      }

      // Byg klassement-snapshot pr. race
      for (const raceId of new Set([...latestByKey.keys()].map((k) => k.split('::')[0]))) {
        const race = lineupRaces.find((r) => r.id === raceId)
        if (!race) continue

        const buildEntry = (
          riderId: string,
          position: number,
          extras: { gcGap?: boolean; youthGap?: boolean; pointsValue?: number | null; mountainValue?: number | null },
        ): ClassementRider | null => {
          const base = riderInfoMap.get(riderId)
          if (!base) return null
          const entry: ClassementRider = { ...base, position }
          const info = latestByKey.get(`${raceId}::${riderId}`)
          if (extras.gcGap) {
            // GC: brug gc_gap_seconds direkte fra DB (scraped fra PCS' GC-tabel inkl. bonus-sek)
            entry.time_gap_seconds = position === 1 ? 0 : (info?.gc_gap_seconds ?? null)
          }
          if (extras.youthGap) {
            // Youth: brug youth_gap_seconds direkte fra DB (scraped)
            entry.time_gap_seconds = position === 1 ? 0 : (info?.youth_gap_seconds ?? null)
          }
          if (extras.pointsValue != null) entry.points = extras.pointsValue
          if (extras.mountainValue != null) entry.points = extras.mountainValue
          return entry
        }

        const gcTop: ClassementRider[] = []
        const pointsTop: ClassementRider[] = []
        const mountainTop: ClassementRider[] = []
        const youthTop: ClassementRider[] = []
        let leader: ClassementRider | null = null
        let pointsLeader: ClassementRider | null = null
        let mountainLeader: ClassementRider | null = null
        let youthLeader: ClassementRider | null = null

        for (const [key, info] of latestByKey) {
          if (!key.startsWith(`${raceId}::`)) continue
          if (info.dnfEver) continue
          const riderId = key.split('::')[1]
          if (info.gc_position != null && info.gc_position <= 10) {
            const e = buildEntry(riderId, info.gc_position, { gcGap: true })
            if (e) gcTop.push(e)
          }
          if (info.points_position != null && info.points_position <= 10) {
            const e = buildEntry(riderId, info.points_position, { pointsValue: info.points_value })
            if (e) pointsTop.push(e)
          }
          if (info.mountain_position != null && info.mountain_position <= 10) {
            const e = buildEntry(riderId, info.mountain_position, { mountainValue: info.mountain_value })
            if (e) mountainTop.push(e)
          }
          if (info.youth_position != null && info.youth_position <= 10) {
            const e = buildEntry(riderId, info.youth_position, { youthGap: true })
            if (e) youthTop.push(e)
          }
        }

        gcTop.sort((a, b) => a.position - b.position)
        pointsTop.sort((a, b) => a.position - b.position)
        mountainTop.sort((a, b) => a.position - b.position)
        youthTop.sort((a, b) => a.position - b.position)

        // Find faktiske trøje-bærere (PCS-regler): GC-leder bærer altid Maglia
        // Rosa. De andre trøjer bæres af næste berettigede klassement-leder der
        // ikke allerede bærer en højere trøje. Sker fx når Eulálio er #1 i
        // både GC og points — han bærer rosa, og ciclamino går til points #2.
        const usedIds = new Set<string>()
        leader = gcTop.find((r) => r.position === 1) ?? null
        if (leader) usedIds.add(leader.rider_id)
        pointsLeader = pointsTop.find((r) => !usedIds.has(r.rider_id)) ?? null
        if (pointsLeader) usedIds.add(pointsLeader.rider_id)
        mountainLeader = mountainTop.find((r) => !usedIds.has(r.rider_id)) ?? null
        if (mountainLeader) usedIds.add(mountainLeader.rider_id)
        youthLeader = youthTop.find((r) => !usedIds.has(r.rider_id)) ?? null

        if (leader || pointsLeader || mountainLeader || youthLeader || gcTop.length > 0) {
          lineupClassements[raceId] = {
            raceName: race.name,
            leader, pointsLeader, mountainLeader, youthLeader,
            gcTop, pointsTop, mountainTop, youthTop,
          }
        }
      }

    }

    // Hent EFFEKTIV brutto-trup (med hviledags-transfers anvendt), så indbyttede
    // ryttere også vises i truppen — ikke kun den oprindelige squad.
    const allSquadIds = (userSquads ?? []).map((sq) => sq.id)
    if (allSquadIds.length > 0) {
      const effRiders = await getEffectiveSquadRidersForSquads(allSquadIds)
      if (effRiders.length > 0) {
        const catById = new Map(effRiders.map((e) => [e.rider_id, e.category_slot]))
        const { data: rd } = await supabaseAdmin
          .from('cycling_riders')
          .select('id, first_name, last_name, team_name, team_logo_url, photo_url')
          .in('id', effRiders.map((e) => e.rider_id))
        lineupSquadRiders = (rd ?? []).map((r) => ({
          id: r.id as string,
          first_name: r.first_name as string,
          last_name: r.last_name as string,
          team_name: r.team_name as string,
          team_logo_url: (r.team_logo_url as string | null) ?? null,
          photo_url: (r.photo_url as string | null) ?? null,
          category: catById.get(r.id as string) ?? 5,
        }))
      }
    }

  }

  // ── Championship mode data ────────────────────────────────────────────────
  type ChampionshipMatch = {
    id: number
    kickoff: string
    status: string
    bet_open: boolean
    bet_lock_at: string | null
    result: string | null
    home_score: number | null
    away_score: number | null
    home_team: { id: number; name: string; logo_url: string | null }
    away_team: { id: number; name: string; logo_url: string | null }
  }
  type ChampionshipRound = {
    id: number
    name: string
    status: string
    betting_closes_at: string | null
    championship_round_matches: { match_id: number; matches: ChampionshipMatch }[]
  }
  let championshipRounds: ChampionshipRound[] = []

  if (typedGame.championship_mode) {
    const { data: cRounds } = await supabaseAdmin
      .from('championship_rounds')
      .select(`
        id, name, status, betting_closes_at,
        championship_round_matches(
          match_id,
          matches(
            id, kickoff, status, bet_open, bet_lock_at, result,
            home_score, away_score,
            home_team:teams!home_team_id(id, name, logo_url),
            away_team:teams!away_team_id(id, name, logo_url)
          )
        )
      `)
      .eq('season', getCurrentChampionshipSeason())
      .order('betting_closes_at', { ascending: true })

    championshipRounds = (cRounds ?? []).filter(
      (cr: { championship_round_matches: unknown[] }) => cr.championship_round_matches.length > 0
    ) as unknown as ChampionshipRound[]
  }

  const members = (rawMembers ?? []) as unknown as MemberRow[]
  const typedRounds = (rounds ?? []) as Round[]

  const scoreMap: RoundScoreMap = {}
  for (const s of (roundScores ?? []) as RoundScore[]) {
    if (!scoreMap[s.user_id]) scoreMap[s.user_id] = {}
    scoreMap[s.user_id][s.round_id] = s.points_earned
  }

  const ranked = assignRanks(
    members.map((m) => ({
      user_id: m.user_id,
      username: m.profile?.username ?? 'Ukendt',
      earnings: m.earnings,
    }))
  )

  const now = new Date()
  const roundsWithStatus = typedRounds.map((r) => ({
    ...r,
    computedStatus: computeRoundStatus(r, now),
  }))

  const sortedRounds = [...roundsWithStatus].sort((a, b) => {
    const aDate = a.betting_closes_at ?? ''
    const bDate = b.betting_closes_at ?? ''
    return aDate.localeCompare(bDate)
  })

  const finishedRounds = sortedRounds.filter((r) => r.computedStatus === 'finished')

  // ── Block data ────────────────────────────────────────────────────────────
  type BlockRow = { id: number; season_id: number; block_number: number; name: string; status: string }
  const typedBlocks = (blocks ?? []) as BlockRow[]
  const blockById = new Map<number, BlockRow>()
  for (const b of typedBlocks) blockById.set(b.id, b)
  const activeBlock = typedBlocks.find((b) => b.status === 'active') ?? null

  // Block-standings renderes nu af FootballLiveSection (polles live via useGameState)
  const roundsWithBlock = sortedRounds as (typeof sortedRounds[number] & { block_id?: number | null })[]

  const activeRound =
    sortedRounds.find((r) => r.computedStatus === 'active') ??
    sortedRounds.find((r) => r.computedStatus === 'open') ??
    sortedRounds.find((r) => r.computedStatus === 'upcoming') ??
    null

  // Initial game state til FootballLiveSection (leaderboard + block-standings polles klient-side)
  const initialGameState = typedGame.sport !== 'cycling'
    ? await getGameState(gameId, user.id)
    : null

  // Seneste færdige runde
  const latestFinished = [...sortedRounds]
    .filter((r) => r.computedStatus === 'finished')
    .pop() ?? null

  // Hent alle kampe for kalender-slider
  type RawMatch = {
    id: number
    kickoff_at: string
    status: string
    result: string | null
    round_name: string
    season_id: number
    home_score: number | null
    away_score: number | null
    home_team: { id: number; name: string }
    away_team: { id: number; name: string }
  }
  const { data: allMatchesRaw } =
    seasonIds.length > 0
      ? await supabase
          .from('matches')
          .select(`
            id, kickoff_at:kickoff, status, result,
            round_name, season_id,
            home_score, away_score,
            home_team:teams!home_team_id(id, name),
            away_team:teams!away_team_id(id, name)
          `)
          .in('season_id', seasonIds)
          .order('kickoff', { ascending: true })
      : { data: [] as RawMatch[] }

  const typedRawMatches = (allMatchesRaw ?? []) as RawMatch[]

  // Build season_id+round_name → round.id lookup for bets/counts
  const roundIdByKey = new Map<string, number>()
  for (const r of sortedRounds) {
    if (r.season_id) roundIdByKey.set(`${r.season_id}-${r.name}`, r.id)
  }

  // Match → round_id lookup for bets
  const matchRoundMap = new Map<number, number>()
  for (const m of typedRawMatches) {
    const rid = roundIdByKey.get(`${m.season_id}-${m.round_name}`)
    if (rid != null) matchRoundMap.set(m.id, rid)
  }

  // Match count per round
  const matchCountByRound: Record<number, number> = {}
  for (const m of typedRawMatches) {
    const rid = roundIdByKey.get(`${m.season_id}-${m.round_name}`)
    if (rid != null) matchCountByRound[rid] = (matchCountByRound[rid] ?? 0) + 1
  }

  // Rivalry lookup — én query for alle kampe
  const rawMatchTeamIds = [...new Set(
    typedRawMatches
      .flatMap((m) => [m.home_team?.id, m.away_team?.id])
      .filter((id): id is number => id != null)
  )]
  const rivalryPairs = new Set<string>()
  if (rawMatchTeamIds.length > 0) {
    const { data: rivalries } = await supabaseAdmin
      .from('rivalries')
      .select('team_id, rival_team_id')
      .in('team_id', rawMatchTeamIds)
      .in('rival_team_id', rawMatchTeamIds)
    for (const r of rivalries ?? []) {
      rivalryPairs.add(`${r.team_id}:${r.rival_team_id}`)
      rivalryPairs.add(`${r.rival_team_id}:${r.team_id}`)
    }
  }
  const rivalryMatchIds = new Set<number>(
    typedRawMatches
      .filter((m) => {
        const h = m.home_team?.id
        const a = m.away_team?.id
        return h != null && a != null && rivalryPairs.has(`${h}:${a}`)
      })
      .map((m) => m.id)
  )
  const rivalryRoundIds = new Set<number>()
  for (const matchId of rivalryMatchIds) {
    const roundId = matchRoundMap.get(matchId)
    if (roundId != null) rivalryRoundIds.add(roundId)
  }

  // Map to CalendarMatch
  const allMatches: CalendarMatch[] = typedRawMatches.map((m) => ({
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    round_name: m.round_name,
    season_id: m.season_id,
    home_team: m.home_team?.name ?? '',
    away_team: m.away_team?.name ?? '',
    home_score: m.home_score,
    away_score: m.away_score,
    isRivalry: rivalryMatchIds.has(m.id),
  }))

  const leagueInfo = defaultLeagueInfo

  // Hent brugerens bets for alle runder (til ActiveRounds)
  const allMatchIds = allMatches.map((m) => m.id)
  const { data: allUserBets } =
    allMatchIds.length > 0
      ? await supabase
          .from('bets')
          .select('id, match_id')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .in('match_id', allMatchIds)
      : { data: [] as { id: number; match_id: number }[] }

  const openRounds = sortedRounds.filter((r) => r.bet_open === true)

  const userBetsByRound: Record<number, number> = {}
  const seenMatchIds = new Set<number>()

  for (const b of allUserBets ?? []) {
    if (seenMatchIds.has(b.match_id)) continue
    seenMatchIds.add(b.match_id)
    const roundId = matchRoundMap.get(b.match_id)
    if (roundId != null) {
      userBetsByRound[roundId] = (userBetsByRound[roundId] ?? 0) + 1
    }
  }
  const activeRoundRows: ActiveRoundRow[] = openRounds.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    betting_closes_at: r.betting_closes_at,
    totalMatches: matchCountByRound[r.id] ?? 0,
    userBets: userBetsByRound[r.id] ?? 0,
    leagueAbbr: (r.season_id ? seasonLeagueMap.get(r.season_id)?.abbr : undefined) ?? leagueInfo.abbr,
    leagueType: (r.season_id ? seasonLeagueMap.get(r.season_id)?.type : undefined) ?? leagueInfo.type,
    logo_url: (r.season_id ? seasonLeagueMap.get(r.season_id)?.logo_url : undefined) ?? null,
    hasRivalry: rivalryRoundIds.has(r.id),
  }))

  // ── Championship mode: override rounds + matches ──────────────────────────
  if (typedGame.championship_mode && championshipRounds.length > 0) {
    const now2 = new Date()

    // Hent brugerens bets for championship kampe
    const champMatchIds = championshipRounds.flatMap((cr) =>
      cr.championship_round_matches.map((crm) => crm.matches.id)
    )
    const { data: champUserBets } = champMatchIds.length > 0
      ? await supabase
          .from('bets')
          .select('id, match_id')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .in('match_id', champMatchIds)
      : { data: [] as { id: number; match_id: number }[] }

    const champBetMatchIds = new Set((champUserBets ?? []).map((b) => b.match_id))

    // Build ActiveRoundRows fra championship_rounds
    const openChampRounds = championshipRounds
      .filter((cr) => cr.championship_round_matches.length > 0)
      .filter((cr) => cr.status !== 'finished')

    // Vis altid første åbne runde
    // Vis anden runde hvis første lukker inden for 24 timer
    const visibleChampRounds = openChampRounds.slice(0, 1)
    if (openChampRounds.length > 1 && openChampRounds[0].betting_closes_at) {
      const firstCloses = new Date(openChampRounds[0].betting_closes_at)
      const hoursUntilClose = (firstCloses.getTime() - now2.getTime()) / (1000 * 60 * 60)
      if (hoursUntilClose < 24) {
        visibleChampRounds.push(openChampRounds[1])
      }
    }

    const champActiveRows: ActiveRoundRow[] = visibleChampRounds
      .map((cr) => {
        const matchIds = cr.championship_round_matches.map((crm) => crm.matches.id)
        return {
          id: cr.id,
          name: cr.name,
          status: cr.status,
          betting_closes_at: cr.betting_closes_at,
          totalMatches: cr.championship_round_matches.length,
          userBets: matchIds.filter((mid) => champBetMatchIds.has(mid)).length,
          leagueAbbr: 'BBR',
          leagueType: 'cup' as const,
          logo_url: null,
          hasRivalry: true,
          href: `/games/${gameId}/championship/${cr.id}`,
        }
      })

    // Override activeRoundRows
    activeRoundRows.length = 0
    activeRoundRows.push(...champActiveRows)

    // Build CalendarMatches fra championship kampe
    allMatches.length = 0
    for (const cr of championshipRounds) {
      for (const crm of cr.championship_round_matches) {
        if (!crm.matches) continue
        const m = crm.matches
        allMatches.push({
          id: m.id,
          kickoff_at: m.kickoff,
          status: m.status,
          round_name: cr.name,
          season_id: 0,
          home_team: m.home_team?.name ?? '',
          away_team: m.away_team?.name ?? '',
          home_score: m.home_score,
          away_score: m.away_score,
          isRivalry: true,
        })
      }
    }
  }

  const myEntry = ranked.find((r) => r.user_id === user.id)

  // ── Byg ticker-beskeder ──────────────────────────────────────────────────────
  const tickerItems: string[] = []

  // Seneste resultater fra afsluttede runde
  for (const m of recentMatches ?? []) {
    if (m.home_score !== null && m.away_score !== null) {
      const kickoff = (m as { kickoff_at?: string }).kickoff_at
      const dateStr = kickoff
        ? new Date(kickoff).toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short' })
        : ''
      const suffix = dateStr ? ` · ${dateStr}` : ''
      const homeName = (m.home_team as unknown as { name: string })?.name ?? '?'
      const awayName = (m.away_team as unknown as { name: string })?.name ?? '?'
      tickerItems.push(`⚽ ${homeName} ${m.home_score}–${m.away_score} ${awayName}${suffix}`)
    }
  }

  // Bet-deadline
  if (activeRound && activeRound.computedStatus === 'open' && activeRound.betting_closes_at) {
    tickerItems.push(
      `🔓 Bets til ${activeRound.name} er åbne — deadline ${formatDateTime(activeRound.betting_closes_at)}`
    )
  }

  // Bedste better i seneste runde
  if (latestFinished) {
    let topUserId = ''
    let topPts = -Infinity
    for (const entry of ranked) {
      const pts = scoreMap[entry.user_id]?.[latestFinished.id] ?? null
      if (pts !== null && pts > topPts) { topPts = pts; topUserId = entry.user_id }
    }
    const topEntry = ranked.find((r) => r.user_id === topUserId)
    const totalInRound = (recentMatches ?? []).length || null
    if (topEntry && topPts > 0) {
      const suffix = totalInRound ? `/${totalInRound} rigtige` : ' pt'
      tickerItems.push(`🏆 Rundens bedste: ${topEntry.username} — ${topPts}${suffix}`)
    }
  }

  // Spillere der mangler bets til aktiv runde
  const usersWithBets = new Set((roundBets ?? []).map((b) => b.user_id))
  if (activeRound && activeRound.computedStatus === 'open') {
    for (const entry of ranked) {
      if (!usersWithBets.has(entry.user_id)) {
        tickerItems.push(`⚠️ ${entry.username} har ikke afgivet bets endnu`)
      }
    }
  }

  // Streaks — consecutive runder med positiv score
  const sortedFinishedRounds = sortedRounds
    .filter((r) => r.computedStatus === 'finished')
    .slice()
  for (const entry of ranked) {
    let streak = 0
    for (let i = sortedFinishedRounds.length - 1; i >= 0; i--) {
      const pts = scoreMap[entry.user_id]?.[sortedFinishedRounds[i].id] ?? null
      if (pts !== null && pts > 0) { streak++ } else break
    }
    if (streak >= 2) {
      tickerItems.push(`🔥 ${entry.username} er på ${streak} vundne runder i træk`)
    }
  }

  // Altid-tilstedeværende info (vises når dynamisk data endnu mangler)
  tickerItems.push(`🏟 ${typedGame.name} · ${members.length} deltagere · ${typedRounds.length} runder`)
  if (activeRound && activeRound.computedStatus !== 'open') {
    tickerItems.push(`📅 ${activeRound.name} er den aktive runde`)
  }
  if (!activeRound && latestFinished) {
    tickerItems.push(`✅ Alle runder afsluttet i ${typedGame.name}`)
  }

  // ── Cycling-specifikke ticker-items ─────────────────────────────────────
  if (typedGame.sport === 'cycling' && lineupRaces.length > 0) {
    const dayMs = 24 * 60 * 60 * 1000
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sortedByDate = [...lineupRaces].sort((a, b) =>
      a.start_date.localeCompare(b.start_date)
    )
    const upcoming = sortedByDate.filter((r) => r.status !== 'finished')
    const allFinished = upcoming.length === 0

    if (allFinished) {
      // Find seneste end_date (eller start_date for one_day)
      const lastDateStr = sortedByDate
        .map((r) => r.start_date)
        .sort()
        .pop()
      if (lastDateStr) {
        const lastEnd = new Date(lastDateStr)
        const daysSince = Math.floor((today.getTime() - lastEnd.getTime()) / dayMs)
        const daysUntilArchive = Math.max(0, 14 - daysSince)
        if (typedGame.status === 'finished') {
          tickerItems.push(`🏁 ${typedGame.name} er arkiveret — historik er stadig tilgængelig`)
        } else if (daysUntilArchive === 0) {
          tickerItems.push(`⏳ Sidste løb er kørt — ${typedGame.name} arkiveres i dag`)
        } else {
          tickerItems.push(
            `⏳ Sidste løb er kørt — ${typedGame.name} arkiveres om ${daysUntilArchive} ${daysUntilArchive === 1 ? 'dag' : 'dage'}`
          )
          if (typedGame.host_id === user.id) {
            tickerItems.push(`💡 Du er host — tilføj nye løb for at fortsætte spilrummet`)
          }
        }
      }
    } else {
      const next = upcoming[0]
      const last = upcoming[upcoming.length - 1]
      const daysToNext = Math.floor((new Date(next.start_date).getTime() - today.getTime()) / dayMs)
      const daysToLast = Math.floor((new Date(last.start_date).getTime() - today.getTime()) / dayMs)

      if (upcoming.length === 1) {
        if (daysToNext === 0) {
          tickerItems.push(`🚨 Sidste løb i ${typedGame.name} kører i dag: ${next.name}`)
        } else if (daysToNext === 1) {
          tickerItems.push(`🚴 Kun ét løb tilbage i ${typedGame.name} — ${next.name} (i morgen)`)
        } else if (daysToNext > 0) {
          tickerItems.push(
            `🚴 Kun ét løb tilbage i ${typedGame.name} — ${next.name} om ${daysToNext} dage`
          )
        }
      } else if (upcoming.length <= 3) {
        tickerItems.push(`🚴 Kun ${upcoming.length} løb tilbage i ${typedGame.name}`)
      }

      if (daysToLast >= 0 && daysToLast <= 14 && upcoming.length <= 3) {
        const lastDate = new Date(last.start_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
        tickerItems.push(`🏁 Sidste løb i sæsonen: ${last.name} · ${lastDate}`)
      }
    }
  }

  // ── Per-bruger statistik til leaderboard ───────────────────────────────────
  const placedBetIds = usersWithBets

  const leaderboardRows = ranked.map((entry) => {
    const wins = finishedRounds.filter((r) => (scoreMap[entry.user_id]?.[r.id] ?? null) !== null && (scoreMap[entry.user_id]?.[r.id] ?? 0) > 0).length
    const played = finishedRounds.filter((r) => (scoreMap[entry.user_id]?.[r.id] ?? null) !== null).length
    const losses = played - wins
    const hasActiveBet = placedBetIds.has(entry.user_id)

    // Form — sidste 5 runder: 'W' | 'L' | null
    const form = finishedRounds.slice(-5).map((r) => {
      const pts = scoreMap[entry.user_id]?.[r.id] ?? null
      if (pts === null) return null
      return pts > 0 ? 'W' : 'L'
    })

    // Pointændring siden sidste runde
    const lastRound = finishedRounds[finishedRounds.length - 1]
    const lastRoundPoints = lastRound ? (scoreMap[entry.user_id]?.[lastRound.id] ?? null) : null

    const achievement = achievementMap.get(entry.user_id) ?? null
    return { ...entry, wins, losses, played, hasActiveBet, form, lastRoundPoints, achievement }
  })

  return (
    <GameStateProvider gameId={gameId} initialState={initialGameState}>
    <div className="min-h-screen" style={{ background: '#F2EDE4', fontFamily: "'Barlow', sans-serif" }}>
      <NavbarSportTheme sport={typedGame.sport} />
      <GameTicker items={tickerItems} />

      {/* Free-event pitch banner — vises kun for gratis-spilrum til brugere
          uden aktivt medlemskab. Konverteringsskub efter eventet slutter. */}
      {gameIsFreeEvent && !viewerIsPaying && <FreeEventPitchBanner />}

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{ background: theme.primary, color: '#F2EDE4', padding: '24px 20px 28px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Top: navn + invite-kode */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1, color: '#F2EDE4' }}>
                {typedGame.name}
              </h1>
              <span style={{ display: 'inline-block', marginTop: 6, background: 'rgba(242,237,228,0.15)', border: '1px solid rgba(242,237,228,0.3)', color: '#F2EDE4', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2 }}>
                {typedGame.status === 'active' ? 'Aktiv' : 'Afsluttet'}
              </span>
            </div>
            <InviteCodeShare code={typedGame.invite_code} />
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid rgba(242,237,228,0.15)', paddingTop: 16 }}>
            {[
              { label: 'Deltagere', value: String(members.length), gold: false },
              { label: 'Runder',    value: String(typedRounds.length), gold: false },
              { label: 'Placering', value: myEntry ? `#${myEntry.rank}` : '—', gold: false },
              { label: 'Dine point', value: myEntry?.earnings.toLocaleString('da-DK') ?? '—', gold: true },
            ].map((stat, i) => (
              <div key={stat.label} style={{ paddingLeft: i > 0 ? 12 : 0, paddingRight: i < 3 ? 12 : 0, borderRight: i < 3 ? '1px solid rgba(242,237,228,0.15)' : 'none' }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.5)', marginBottom: 4 }}>{stat.label}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: stat.gold ? '#B8963E' : '#F2EDE4', lineHeight: 1 }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Kalender-slider */}
        {/* Arkiveret-banner */}
        {typedGame.status === 'finished' && (
          <div style={{
            background: '#F8F5ED',
            border: '1px solid #C8BEA8',
            borderRadius: 2,
            padding: '14px 16px',
            margin: '0 0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                color: '#7a7060', marginBottom: 4,
              }}>
                Spilrum afsluttet
              </div>
              <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 13, color: '#1a1a1a',
              }}>
                Resultater og historik er låst.
                {typedGame.host_id === user.id && typedGame.sport === 'cycling' && (
                  <> Du kan reaktivere ved at tilføje nye løb.</>
                )}
              </div>
            </div>
            {typedGame.host_id === user.id && typedGame.sport === 'cycling' && (
              <Link
                href={`/games/${gameId}/cycling/add-races`}
                style={{
                  padding: '8px 14px',
                  background: theme.primary, color: '#F2EDE4',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderRadius: 2, textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                + Tilføj løb
              </Link>
            )}
          </div>
        )}

        <section className="border-t border-b border-[#d4cec4] py-0">
          {typedGame.sport === 'cycling' ? (
            <CyclingCalendarSlider events={cyclingEvents} sportColor={theme.primary} />
          ) : (
            <>
              <CalendarSlider
                matches={allMatches}
                rounds={(typedGame.championship_mode
                  ? championshipRounds.filter((cr) => cr.status === 'active' || (cr.betting_closes_at && new Date(cr.betting_closes_at) > new Date()) || cr.championship_round_matches.length > 0).map((cr) => {
                      const now2 = new Date()
                      const status = cr.status === 'finished' ? 'finished' as const
                        : cr.betting_closes_at && new Date(cr.betting_closes_at) > now2 ? 'open' as const
                        : cr.status === 'active' ? 'active' as const
                        : 'upcoming' as const
                      return {
                        id: cr.id,
                        name: cr.name,
                        season_id: 0,
                        computedStatus: status,
                        betting_closes_at: cr.betting_closes_at,
                        leagueAbbr: 'BBR',
                        leagueType: 'cup' as const,
                        logo_url: null,
                        block_id: null,
                        block_number: null,
                      }
                    })
                  : roundsWithBlock.map((r) => ({
                      id: r.id,
                      name: r.name,
                      season_id: r.season_id ?? 0,
                      computedStatus: r.computedStatus,
                      betting_closes_at: r.betting_closes_at,
                      leagueAbbr: (r.season_id ? seasonLeagueMap.get(r.season_id)?.abbr : undefined) ?? leagueInfo.abbr,
                      leagueType: (r.season_id ? seasonLeagueMap.get(r.season_id)?.type : undefined) ?? leagueInfo.type,
                      logo_url: (r.season_id ? seasonLeagueMap.get(r.season_id)?.logo_url : undefined) ?? null,
                      block_id: r.block_id ?? null,
                      block_number: r.block_id != null ? (blockById.get(r.block_id)?.block_number ?? null) : null,
                    }))
                ) as CalendarRound[]}
                gameId={gameId}
                betsCount={roundBets?.filter((b) => b.user_id === user.id)?.length ?? 0}
                activeRoundId={activeRound?.id ?? null}
                activeBlockId={activeBlock?.id ?? null}
                sportColor={theme.primary}
              />
              <ActiveRoundLiveTicker />
            </>
          )}
        </section>

        {/* Cykling sektion — trup + lineup overview + builder */}
        {typedGame.sport === 'cycling' && (
          <>
            <CyclingGameroom
              gameId={gameId}
              squadId={userSquad?.id ?? null}
              activeBlock={cyclingActiveBlock}
              races={lineupRaces}
              squadRiders={lineupSquadRiders}
              classements={lineupClassements}
            />
            <LineupBuilder
              gameId={gameId}
              blockSquadMap={blockSquadMap}
              races={lineupRaces}
              stages={lineupStages}
              startlists={lineupStartlists}
              abandoned={lineupAbandoned}
              standings={lineupStandings}
              squadRiders={lineupSquadRiders}
              blocks={cyclingBlocks}
              defaultBlockId={cyclingActiveBlock?.id ?? null}
              lockDeadline={cyclingActiveBlock?.lock_deadline ?? null}
              squadRiderCount={lineupSquadRiders.length}
              squadId={userSquad?.id ?? null}
              currentUserId={user.id}
            />
            <CyclingBlockStanding gameId={gameId} blockName={cyclingActiveBlockDisplayName} blockStatus={cyclingActiveBlockStatus} />
            <Leaderboard gameId={gameId} />
            {typedGame.host_id === user.id && (
              <Link
                href={`/games/${gameId}/cycling/add-races`}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '10px 16px', marginTop: 12,
                  background: theme.primary, color: '#F2EDE4',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderRadius: 2, textDecoration: 'none', cursor: 'pointer',
                }}
              >
                + Tilføj løb til spilrum
              </Link>
            )}
            <RolesGuide />
          </>
        )}

        {/* Live fodbold-sektion: block-leaderboard + leaderboard polles via useGameState */}
        {typedGame.sport !== 'cycling' && initialGameState && (
          <FootballLiveSection
            gameId={gameId}
            currentUserId={user.id}
            initialState={initialGameState}
            theme={{ primary: theme.primary, primaryLight: theme.primaryLight }}
          />
        )}

        {/* Aktive betting runder — kun fodbold */}
        {typedGame.sport !== 'cycling' && (
          <>
            <ActiveRounds rounds={activeRoundRows} gameId={gameId} />
            {sortedRounds.length === 0 && (
              <div style={{ border: '1px dashed #C8BEA8', borderRadius: 2, padding: '48px 16px', textAlign: 'center', color: '#6b6b6b', fontFamily: "'Barlow', sans-serif", fontSize: 14 }}>
                Ingen runder oprettet endnu
              </div>
            )}
          </>
        )}

        {/* Leaderboard for fodbold renderes af FootballLiveSection ovenfor */}

        {/* Detaljeret fodbold leaderboard (form, achievements) */}
        {false && typedGame.sport !== 'cycling' && <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b6b6b' }}>Leaderboard</span>
          </div>

          <div style={{ background: '#FDFAF5', border: '1px solid #C8BEA8', borderRadius: 2, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto 52px', padding: '8px 12px', background: '#E8E0D3', borderBottom: '1px solid #C8BEA8', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6b6b', textAlign: 'center' }}>#</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6b6b' }}>Spiller</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6b6b', textAlign: 'center' }}>Form</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6b6b', textAlign: 'right' }}>PT</span>
            </div>

            {leaderboardRows.map((entry, idx) => {
              const isMe = entry.user_id === user.id
              const rankColor = entry.rank === 1 ? '#B8963E' : entry.rank === 2 ? '#8A9BA8' : entry.rank === 3 ? '#A0785A' : '#6b6b6b'
              const isTop3 = entry.rank <= 3
              const isLast = idx === leaderboardRows.length - 1 && leaderboardRows.length > 3

              return (
                <div
                  key={entry.user_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto 52px',
                    padding: '10px 12px',
                    borderBottom: idx < leaderboardRows.length - 1 ? '1px solid #E8E0D3' : 'none',
                    gap: 8,
                    alignItems: 'center',
                    background: isMe ? `${theme.primary}0D` : undefined,
                    borderLeft: (isTop3 && leaderboardRows.length > 3) ? `3px solid ${theme.primary}` : (isLast && leaderboardRows.length > 1) ? '3px solid #8B2E2E' : '3px solid transparent',
                  }}
                >
                  {/* Rank */}
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, textAlign: 'center', color: rankColor }}>
                    {entry.rank}
                  </span>

                  {/* Spiller */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isMe ? theme.primaryLight : theme.primary, color: '#F2EDE4', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {entry.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, color: '#1a1a1a' }}>
                        {entry.username}{isMe && <span style={{ fontSize: 11, color: '#6b6b6b', fontWeight: 300 }}> · dig</span>}
                      </div>
                      {entry.achievement && (
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#6b6b6b', lineHeight: 1, marginTop: 2 }}>
                          {entry.achievement.icon} {entry.achievement.name}
                        </div>
                      )}
                      {activeRound && (
                        <div style={{ fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: entry.hasActiveBet ? '#4CAF50' : '#D4A017', flexShrink: 0 }} />
                          <span style={{ color: entry.hasActiveBet ? '#4CAF50' : '#B8860B' }}>
                            {entry.hasActiveBet ? 'Bets afgivet' : 'Mangler bets'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form — sidste 5 runder */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
                    {entry.form.map((f, i) => (
                      <div
                        key={i}
                        title={f === 'W' ? 'Vundet' : f === 'L' ? 'Tabt' : 'Ingen bets'}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 2,
                          background: f === 'W' ? theme.primary : f === 'L' ? '#8B2E2E' : '#E8E0D3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {f && (
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                            {f}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* PT + pointændring */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: entry.rank === 1 ? '#B8963E' : '#1a1a1a', lineHeight: 1 }}>
                      {entry.earnings.toLocaleString('da-DK')}
                    </div>
                    {entry.lastRoundPoints !== null && (
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 600, color: entry.lastRoundPoints > 0 ? theme.primary : '#8B2E2E', lineHeight: 1, marginTop: 2 }}>
                        {entry.lastRoundPoints > 0 ? `+${entry.lastRoundPoints}` : `${entry.lastRoundPoints}`}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 2px 0', alignItems: 'center' }}>
            {[
              { dot: '#4CAF50', label: 'Bets afgivet' },
              { dot: '#7a7060', label: 'Mangler bets' },
            ].map(({ dot, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b6b6b', fontWeight: 300 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
                {label}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6b6b6b', fontWeight: 300 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: theme.primary }} />
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#8B2E2E' }} />
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#E8E0D3' }} />
              </div>
              W · L · —
            </div>
          </div>
        </div>}
      </div>
    </div>
    </GameStateProvider>
  )
}

