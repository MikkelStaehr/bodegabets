import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import DashboardContent from '@/components/dashboard/DashboardContent'
import JoinGameCard from '@/components/dashboard/JoinGameCard'
import type { SportType, GameRowWithSport } from '@/components/dashboard/DashboardContent'

type ActiveRoundResult = {
  id: number
  game_id: number
  name: string
  status: string
  betting_closes_at: string | null
  round_status: 'upcoming' | 'active' | 'finished' | null
  matches_count: number
}


async function getActiveRoundForGame(
  gameId: number,
  seasonId: number | null
): Promise<ActiveRoundResult | null> {
  if (!seasonId) return null

  // Hent seneste ikke-færdige runde
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id, name, status, betting_closes_at')
    .eq('season_id', seasonId)
    .neq('status', 'finished')
    .order('betting_closes_at', { ascending: false })
    .limit(1)
  const fallback = rounds?.[0]
  if (!fallback) return null
  return { ...fallback, game_id: gameId, round_status: null, matches_count: 0 }
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, membershipsResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('username, points, is_admin, onboarding_completed')
      .eq('id', user.id)
      .single(),

    supabaseAdmin
      .from('game_members')
      .select('game_id, earnings')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),
  ])

  const profile = profileResult.data
  const memberships = membershipsResult.data

  const membershipRows = (memberships ?? []) as { game_id: number; earnings: number }[]
  const gameIds = membershipRows.map((m) => m.game_id)

  if (gameIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4">
        <div className="relative max-w-[480px] w-full py-12 text-center">
          {/* Decorative "?" background */}
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '280px', fontWeight: 700, color: '#B8963E', opacity: 0.08, lineHeight: 1 }}
          >
            ?
          </span>

          {/* Content */}
          <div className="relative z-10">
            <h1
              className="mb-3"
              style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '32px', fontWeight: 700, color: '#1a3329' }}
            >
              Ingen spilrum endnu.
            </h1>
            <p
              className="mb-8 mx-auto max-w-[320px]"
              style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: '15px', color: '#7a7060', lineHeight: 1.6 }}
            >
              Opret dit eget spilrum eller join et eksisterende med en invitationskode.
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/games/new"
                className="inline-flex items-center justify-center gap-2 font-condensed font-bold text-sm uppercase tracking-[0.08em] px-6 py-3 rounded-sm transition-colors min-h-[44px] bg-[#2C4A3E] text-[#F2EDE4] hover:bg-[#1a3329]"
              >
                + Opret spilrum
              </Link>
              <a
                href="#join-section"
                className="inline-flex items-center justify-center gap-2 font-condensed font-bold text-sm uppercase tracking-[0.08em] px-6 py-3 rounded-sm transition-colors min-h-[44px] bg-transparent text-[#2C4A3E] border-[1.5px] border-[#2C4A3E] hover:bg-[#2C4A3E]/5"
              >
                Join med kode
              </a>
            </div>

            {/* Join card */}
            <div className="mt-10" id="join-section">
              <JoinGameCard />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fetch games + season_ids via game_seasons junction
  const [gamesResult, gameSeasonsResult] = await Promise.all([
    supabaseAdmin
      .from('games')
      .select('id, name, status, invite_code, created_at, sport, member_count:game_members(count)')
      .in('id', gameIds),
    supabaseAdmin
      .from('game_seasons')
      .select('game_id, season_id')
      .in('game_id', gameIds),
  ])

  const gamesData = gamesResult.data
  const gameSeasonRows = gameSeasonsResult.data

  const gamesById = new Map<number, { id: number; name: string; status: string; invite_code: string; created_at: string; sport: string; member_count: { count: number }[] }>()
  for (const g of (gamesData ?? []) as { id: number; name: string; status: string; invite_code: string; created_at: string; sport: string; member_count: { count: number }[] }[]) {
    gamesById.set(g.id, g)
  }

  const rawGames = membershipRows
    .filter((m) => gamesById.has(m.game_id))
    .map((m) => ({ game_id: m.game_id, earnings: m.earnings, game: gamesById.get(m.game_id)! }))

  const seasonIdsByGame = new Map<number, number[]>()
  for (const gs of gameSeasonRows ?? []) {
    const gid = gs.game_id as number
    const sid = gs.season_id as number
    if (!seasonIdsByGame.has(gid)) seasonIdsByGame.set(gid, [])
    seasonIdsByGame.get(gid)!.push(sid)
  }

  const seasonIds = [...new Set([...seasonIdsByGame.values()].flat())]

  // Kombinér seasons/tournaments + allMembers + rounds + bets + activeRounds i ét Promise.all
  const results = await Promise.all([
    // [0] seasons/tournaments
    seasonIds.length > 0
      ? supabaseAdmin
          .from('seasons')
          .select('id, tournaments:tournament_id(name, logo_url)')
          .in('id', seasonIds)
      : Promise.resolve({ data: [] }),

    // [1] allMembers
    supabaseAdmin
      .from('game_members')
      .select('game_id, user_id, earnings, profile:profiles!user_id(username)')
      .in('game_id', gameIds)
      .order('earnings', { ascending: false }),

    // [2] rounds
    seasonIds.length > 0
      ? supabaseAdmin
          .from('rounds')
          .select('id, season_id, name, status, betting_closes_at, block_id')
          .in('season_id', seasonIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),

    // [3] bets
    supabaseAdmin
      .from('bets')
      .select('round_id')
      .eq('user_id', user.id),

    // [4] active blocks
    seasonIds.length > 0
      ? supabaseAdmin
          .from('blocks')
          .select('id, season_id, block_number, name, status')
          .in('season_id', seasonIds)
          .eq('status', 'active')
      : Promise.resolve({ data: [] as { id: number; season_id: number; block_number: number; name: string; status: string }[] }),

    // [5+] activeRounds per game
    ...rawGames.map((m) => getActiveRoundForGame(m.game.id, seasonIdsByGame.get(m.game.id)?.[0] ?? null)),
  ])

  // Unpack seasons/tournaments → leagueNameMap + logoUrlMap
  const leagueNameMap = new Map<number, string>()
  const logoUrlMap = new Map<number, string>()
  const seasonsData = (results[0] as { data: { id: number; tournaments: { name: string; logo_url: string | null } | null }[] | null }).data
  for (const s of (seasonsData ?? []) as unknown as { id: number; tournaments: { name: string; logo_url: string | null } | null }[]) {
    if (s.tournaments?.name) leagueNameMap.set(s.id, s.tournaments.name)
    if (s.tournaments?.logo_url) logoUrlMap.set(s.id, s.tournaments.logo_url)
  }

  const allMembers = (results[1] as { data: { game_id: number; user_id: string; earnings: number; profile: { username: string } | null }[] | null }).data
  const rounds = (results[2] as { data: { id: number; season_id: number; name: string; status: string; betting_closes_at: string | null; block_id?: number | null }[] | null }).data
  const bets = (results[3] as { data: { round_id: number }[] | null }).data
  const activeBlocksData = (results[4] as { data: { id: number; season_id: number; block_number: number; name: string }[] | null }).data ?? []
  const activeRoundsPerGame = results.slice(5) as Awaited<ReturnType<typeof getActiveRoundForGame>>[]

  const roundIds = (rounds ?? []).map((r: { id: number }) => r.id)
  const { data: matchesByRound } =
    roundIds.length > 0
      ? await supabaseAdmin
          .from('matches')
          .select('round_id')
          .in('round_id', roundIds)
      : { data: [] }

  const typedRounds = (rounds ?? []) as { id: number; season_id: number; name: string; status: string; betting_closes_at: string | null }[]
  const now = new Date()

  const matchCountByRound = new Map<number, number>()
  for (const m of matchesByRound ?? []) {
    const rid = (m as { round_id: number }).round_id
    matchCountByRound.set(rid, (matchCountByRound.get(rid) ?? 0) + 1)
  }

  const activeRoundByGame = new Map<
    number,
    ActiveRoundResult
  >()
  for (let i = 0; i < rawGames.length; i++) {
    const round = activeRoundsPerGame[i] as Awaited<ReturnType<typeof getActiveRoundForGame>>
    if (round) {
      const fromCurrent = round.matches_count > 0 ? round.matches_count : null
      activeRoundByGame.set(rawGames[i].game.id, {
        ...round,
        matches_count: fromCurrent ?? matchCountByRound.get(round.id) ?? 0,
        round_status: round.round_status ?? null,
      })
    }
  }

  const rankByGame = new Map<number, Map<string, number>>()
  const membersByGame = new Map<number, { user_id: string; earnings: number; profile: { username: string } | null }[]>()
  for (const m of (allMembers ?? []) as { game_id: number; user_id: string; earnings: number; profile: { username: string } | null }[]) {
    if (!membersByGame.has(m.game_id)) membersByGame.set(m.game_id, [])
    membersByGame.get(m.game_id)!.push(m)
  }
  for (const [gid, arr] of membersByGame) {
    const rankMap = new Map<string, number>()
    let rank = 1
    for (let i = 0; i < arr.length; i++) {
      if (i > 0 && arr[i].earnings < arr[i - 1].earnings) rank = i + 1
      rankMap.set(arr[i].user_id, rank)
    }
    rankByGame.set(gid, rankMap)
  }

  const activeRoundIds = [...activeRoundByGame.values()].map((r) => r.id)
  const userBetsInActiveRounds = (bets ?? []).filter((b: { round_id: number }) => activeRoundIds.includes(b.round_id))
  const betsCountByGame = new Map<number, number>()
  for (const r of [...activeRoundByGame.values()]) {
    const count = userBetsInActiveRounds.filter((b: { round_id: number }) => b.round_id === r.id).length
    betsCountByGame.set(r.game_id, count)
  }

  // Build top3 per game (with usernames from profile join)
  const top3ByGame = new Map<number, { user_id: string; username: string; earnings: number }[]>()
  for (const [gid, arr] of membersByGame) {
    top3ByGame.set(
      gid,
      arr.slice(0, 3).map((m) => ({
        user_id: m.user_id,
        username: (m as unknown as { profile: { username: string } | null }).profile?.username ?? 'Ukendt',
        earnings: m.earnings,
      }))
    )
  }

  // Build active block per game
  const activeBlockBySeason = new Map<number, { id: number; season_id: number; block_number: number; name: string }>()
  for (const b of activeBlocksData) activeBlockBySeason.set(b.season_id, b)

  const typedRoundsWithBlock = (rounds ?? []) as { id: number; season_id: number; name: string; status: string; betting_closes_at: string | null; block_id?: number | null }[]
  const activeBlockByGame = new Map<number, { block_number: number; name: string; rounds_remaining: number }>()
  for (const m of rawGames) {
    const gameSeasonIds = seasonIdsByGame.get(m.game.id) ?? []
    for (const sid of gameSeasonIds) {
      const block = activeBlockBySeason.get(sid)
      if (block) {
        const blockRounds = typedRoundsWithBlock.filter((r) => r.block_id === block.id)
        const rounds_remaining = blockRounds.filter((r) => r.status !== 'finished').length
        activeBlockByGame.set(m.game.id, { block_number: block.block_number, name: block.name, rounds_remaining })
        break
      }
    }
  }

  // Build logo URLs + league names per game (multiple leagues possible)
  const logoUrlsByGame = new Map<number, string[]>()
  const leagueNamesByGame = new Map<number, string[]>()
  for (const [gameId, sids] of seasonIdsByGame) {
    const urls: string[] = []
    const names: string[] = []
    for (const sid of sids) {
      const url = logoUrlMap.get(sid)
      const name = leagueNameMap.get(sid)
      if (url && !urls.includes(url)) {
        urls.push(url)
        names.push(name ?? '')
      }
    }
    if (urls.length > 0) logoUrlsByGame.set(gameId, urls)
    if (names.length > 0) leagueNamesByGame.set(gameId, names)
  }

  const games: GameRowWithSport[] = rawGames.map((m) => {
    const g = m.game
    const memberCount = (g.member_count as unknown as { count: number }[])[0]?.count ?? 0
    const activeRound = activeRoundByGame.get(g.id) ?? null
    const rank = rankByGame.get(g.id)?.get(user.id) ?? 1
    const bets_count = betsCountByGame.get(g.id) ?? 0
    const gameSeasonIds = seasonIdsByGame.get(g.id) ?? []
    const leagueName = gameSeasonIds.length > 0 ? leagueNameMap.get(gameSeasonIds[0]) ?? null : null

    return {
      points: m.earnings,
      rank,
      bets_count,
      game: {
        id: g.id,
        name: g.name,
        status: g.status,
        invite_code: g.invite_code,
        member_count: memberCount,
        league_name: leagueName,
        sport_type: (g.sport === 'cycling' ? 'cycling' : 'football') as SportType,
      },
      activeRound: activeRound
        ? {
            id: activeRound.id,
            name: activeRound.name,
            betting_closes_at: activeRound.betting_closes_at,
            matches_count: activeRound.matches_count,
            round_status: activeRound.round_status ?? null,
          }
        : null,
    }
  })

  const activeRounds = [...activeRoundByGame.values()]

  const nextRoundDate = (() => {
    const future = typedRounds
      .filter((r) => r.betting_closes_at && new Date(r.betting_closes_at) > now)
      .map((r) => r.betting_closes_at!)
      .sort()[0]
    if (!future) return null
    return new Date(future).toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  })()

  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-[1100px] mx-auto px-4 max-[768px]:px-4 py-8">
        <DashboardContent
          games={games}
          activeRounds={activeRounds}
          nextRoundDate={nextRoundDate}
          logoUrlsByGame={Object.fromEntries(logoUrlsByGame)}
          leagueNamesByGame={Object.fromEntries(leagueNamesByGame)}
          top3ByGame={Object.fromEntries(top3ByGame)}
          username={profile?.username ?? 'Spiller'}
          activeBlockByGame={Object.fromEntries(activeBlockByGame)}
        />
      </div>
    </div>
  )
}
