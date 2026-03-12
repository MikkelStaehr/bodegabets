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

// Infer sport from league name
function inferSport(leagueName: string | null): SportType {
  if (!leagueName) return 'football'
  const lower = leagueName.toLowerCase()
  if (lower.includes('tour de france') || lower.includes('giro') || lower.includes('vuelta') || lower.includes('cykling') || lower.includes('cycling')) {
    return 'cycling'
  }
  return 'football'
}

async function getActiveRoundForGame(
  gameId: number,
  leagueId: number | null
): Promise<ActiveRoundResult | null> {
  if (!leagueId) return null

  // Hent seneste ikke-færdige runde
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, league_id, name, status, betting_closes_at')
    .eq('league_id', leagueId)
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
      .select('username, points, is_admin')
      .eq('id', user.id)
      .single(),

    supabaseAdmin
      .from('game_members')
      .select('game_id, points')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),
  ])

  const profile = profileResult.data
  const memberships = membershipsResult.data
  console.log('[dashboard] user:', user.id, 'memberships:', memberships, 'membershipsError:', membershipsResult.error)

  const membershipRows = (memberships ?? []) as { game_id: number; points: number }[]
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
                className="inline-flex items-center justify-center gap-2 font-['Barlow_Condensed'] font-bold text-sm uppercase tracking-[0.08em] px-6 py-3 rounded-sm transition-colors min-h-[44px] bg-[#2C4A3E] text-[#F2EDE4] hover:bg-[#1a3329]"
              >
                + Opret spilrum
              </Link>
              <a
                href="#join-section"
                className="inline-flex items-center justify-center gap-2 font-['Barlow_Condensed'] font-bold text-sm uppercase tracking-[0.08em] px-6 py-3 rounded-sm transition-colors min-h-[44px] bg-transparent text-[#2C4A3E] border-[1.5px] border-[#2C4A3E] hover:bg-[#2C4A3E]/5"
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

  // Fetch games + league_ids via game_leagues junction (games.league_id dropped)
  const [gamesResult, gameLeaguesResult] = await Promise.all([
    supabaseAdmin
      .from('games')
      .select('id, name, status, invite_code, created_at, member_count:game_members(count)')
      .in('id', gameIds),
    supabaseAdmin
      .from('game_leagues')
      .select('game_id, league_id')
      .in('game_id', gameIds),
  ])

  const gamesData = gamesResult.data
  const gameLeagueRows = gameLeaguesResult.data
  console.log('[dashboard] gamesData:', gamesData, 'gamesError:', gamesResult.error, 'gameLeagues:', gameLeagueRows, 'gameLeaguesError:', gameLeaguesResult.error)

  const gamesById = new Map<number, { id: number; name: string; status: string; invite_code: string; created_at: string; member_count: { count: number }[] }>()
  for (const g of (gamesData ?? []) as { id: number; name: string; status: string; invite_code: string; created_at: string; member_count: { count: number }[] }[]) {
    gamesById.set(g.id, g)
  }

  const rawGames = membershipRows
    .filter((m) => gamesById.has(m.game_id))
    .map((m) => ({ game_id: m.game_id, points: m.points, game: gamesById.get(m.game_id)! }))

  const leagueIdByGame = new Map<number, number>()
  for (const gl of gameLeagueRows ?? []) {
    leagueIdByGame.set(gl.game_id as number, gl.league_id as number)
  }

  const leagueIds = [...new Set([...leagueIdByGame.values()])]
  const leagueNameMap = new Map<number, string>()
  if (leagueIds.length > 0) {
    const { data: leagues } = await supabaseAdmin
      .from('leagues')
      .select('id, name')
      .in('id', leagueIds)
    for (const l of leagues ?? []) {
      leagueNameMap.set(l.id, l.name)
    }
  }

  const results = await Promise.all([
    supabaseAdmin
      .from('game_members')
      .select('game_id, user_id, earnings')
      .in('game_id', gameIds)
      .order('earnings', { ascending: false }),

    (() => {
      return leagueIds.length > 0
        ? supabaseAdmin
            .from('rounds')
            .select('id, league_id, name, status, betting_closes_at')
            .in('league_id', leagueIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] })
    })(),

    supabaseAdmin
      .from('bets')
      .select('round_id')
      .eq('user_id', user.id),

    ...rawGames.map((m) => getActiveRoundForGame(m.game.id, leagueIdByGame.get(m.game.id) ?? null)),
  ])
  const allMembers = (results[0] as { data: { game_id: number; user_id: string; earnings: number }[] | null }).data
  const rounds = (results[1] as { data: { id: number; league_id: number; name: string; status: string; betting_closes_at: string | null }[] | null }).data
  const bets = (results[2] as { data: { round_id: number }[] | null }).data
  const activeRoundsPerGame = results.slice(3) as Awaited<ReturnType<typeof getActiveRoundForGame>>[]

  const roundIds = (rounds ?? []).map((r: { id: number }) => r.id)
  const { data: matchesByRound } =
    roundIds.length > 0
      ? await supabaseAdmin
          .from('matches')
          .select('round_id')
          .in('round_id', roundIds)
      : { data: [] }

  const typedRounds = (rounds ?? []) as { id: number; league_id: number; name: string; status: string; betting_closes_at: string | null }[]
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
  const membersByGame = new Map<number, { user_id: string; earnings: number }[]>()
  for (const m of (allMembers ?? []) as { game_id: number; user_id: string; earnings: number }[]) {
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

  const betsByRound = new Set((bets ?? []).map((b: { round_id: number }) => b.round_id))
  const activeRoundIds = [...activeRoundByGame.values()].map((r) => r.id)
  const userBetsInActiveRounds = (bets ?? []).filter((b: { round_id: number }) => activeRoundIds.includes(b.round_id))
  const betsCountByGame = new Map<number, number>()
  for (const r of [...activeRoundByGame.values()]) {
    const count = userBetsInActiveRounds.filter((b: { round_id: number }) => b.round_id === r.id).length
    betsCountByGame.set(r.game_id, count)
  }

  const games: GameRowWithSport[] = rawGames.map((m) => {
    const g = m.game
    const memberCount = (g.member_count as unknown as { count: number }[])[0]?.count ?? 0
    const activeRound = activeRoundByGame.get(g.id) ?? null
    const rank = rankByGame.get(g.id)?.get(user.id) ?? 1
    const bets_count = betsCountByGame.get(g.id) ?? 0
    const gameLeagueId = leagueIdByGame.get(g.id) ?? null
    const leagueName = gameLeagueId ? leagueNameMap.get(gameLeagueId) ?? null : null

    return {
      points: m.points,
      rank,
      bets_count,
      game: {
        id: g.id,
        name: g.name,
        status: g.status,
        invite_code: g.invite_code,
        member_count: memberCount,
        league_name: leagueName,
        sport_type: inferSport(leagueName),
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
    return new Date(future).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  })()

  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-[1100px] mx-auto px-4 max-[768px]:px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] font-semibold text-[#7a7060] uppercase tracking-widest mb-1">Velkommen tilbage</p>
            <h1 className="font-['Playfair_Display'] text-4xl font-bold text-[#1a3329]">{profile?.username ?? 'Spiller'}</h1>
            <p className="text-[13px] text-[#7a7060] mt-1">
              {games.length} {games.length === 1 ? 'spilrum' : 'spilrum'} · {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <Link href="/games/new" className="shrink-0 flex items-center gap-2 bg-[#2C4A3E] text-white font-['Barlow_Condensed'] font-bold text-sm uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-[#1a3329] transition-colors">
            + Opret spil
          </Link>
        </div>

        <DashboardContent
          games={games}
          activeRounds={activeRounds}
          nextRoundDate={nextRoundDate}
        />
      </div>
    </div>
  )
}
