import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import DashboardGameCard from '@/components/dashboard/DashboardGameCard'
import LiveSidebar from '@/components/dashboard/LiveSidebar'
import JoinGameCard from '@/components/dashboard/JoinGameCard'
import type { Game } from '@/types'

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
  supabase: SupabaseClient,
  gameId: number,
  leagueId: number | null
): Promise<ActiveRoundResult | null> {
  if (leagueId) {
    const { data: current } = await supabase
      .from('current_rounds')
      .select('round_name, round_status, first_kickoff, next_kickoff, match_count')
      .eq('league_id', leagueId)
      .single()

    if (current?.round_name) {
      const { data: round } = await supabase
        .from('rounds')
        .select('id, game_id, name, status, betting_closes_at')
        .eq('game_id', gameId)
        .eq('name', current.round_name)
        .single()

      if (round) {
        // next_kickoff = næste uafspillede kamp; first_kickoff = første kamp i runden
        const bettingClosesAt = (current as { next_kickoff?: string | null }).next_kickoff ?? current.first_kickoff ?? null
        return {
          ...round,
          betting_closes_at: bettingClosesAt,
          round_status: (current.round_status as 'upcoming' | 'active' | 'finished') ?? null,
          matches_count: (current as { match_count?: number }).match_count ?? 0,
        }
      }
    }
  }

  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, game_id, name, status, betting_closes_at')
    .eq('game_id', gameId)
    .neq('status', 'finished')
    .order('betting_closes_at', { ascending: false })
    .limit(1)
  const fallback = rounds?.[0]
  if (!fallback) return null
  return { ...fallback, round_status: null, matches_count: 0 }
}

type GameRow = {
  points: number
  rank: number
  bets_count: number
  game: Game & { member_count: number }
  activeRound: {
    id: number
    name: string
    betting_closes_at: string | null
    matches_count: number
    round_status: 'upcoming' | 'active' | 'finished' | null
  } | null
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, points, is_admin')
      .eq('id', user.id)
      .single(),

    supabase
      .from('game_members')
      .select(`
        game_id,
        points,
        game:games (
          id, name, description, status, invite_code, created_at, league_id,
          member_count:game_members(count)
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),
  ])

  const rawGames = ((memberships ?? []) as unknown as Array<{ game_id: number; points: number; game: { id: number; name: string; description: string | null; status: string; invite_code: string; created_at: string; league_id: number | null; member_count: { count: number }[] } | null }>).filter((m) => m.game !== null)

  const gameIds = rawGames.map((m) => m.game!.id)

  if (gameIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#F2EDE4]">
        <div className="max-w-[1100px] mx-auto px-4 py-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-[11px] font-semibold text-[#7a7060] uppercase tracking-widest mb-1">Velkommen tilbage</p>
              <h1 className="font-['Playfair_Display'] text-4xl font-bold text-[#1a3329]">{profile?.username ?? 'Spiller'}</h1>
              <p className="text-[13px] text-[#7a7060] mt-1">0 spilrum · {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <Link href="/games/new" className="shrink-0 flex items-center gap-2 bg-[#2C4A3E] text-white font-['Barlow_Condensed'] font-bold text-sm uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-[#1a3329] transition-colors">
              + Opret spil
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-black/8 p-12 text-center">
            <p className="text-[#7a7060] mb-4">Du er ikke med i nogen spilrum endnu</p>
            <Link href="/games/new" className="inline-flex items-center gap-2 text-[#2C4A3E] font-['Barlow_Condensed'] font-bold text-sm uppercase hover:text-[#B8963E] transition-colors">
              Opret dit første spil
            </Link>
          </div>
          <div className="mt-6">
            <JoinGameCard />
          </div>
        </div>
      </div>
    )
  }

  const results = await Promise.all([
    supabase
      .from('game_members')
      .select('game_id, user_id, points')
      .in('game_id', gameIds)
      .order('points', { ascending: false }),

    supabase
      .from('rounds')
      .select('id, game_id, name, status, betting_closes_at')
      .in('game_id', gameIds)
      .order('created_at', { ascending: true }),

    supabase
      .from('bets')
      .select('round_id')
      .eq('user_id', user.id),

    ...rawGames.map((m) => getActiveRoundForGame(supabase, m.game!.id, m.game!.league_id ?? null)),
  ])
  const allMembers = (results[0] as { data: { game_id: number; user_id: string; points: number }[] | null }).data
  const rounds = (results[1] as { data: { id: number; game_id: number; name: string; status: string; betting_closes_at: string | null }[] | null }).data
  const bets = (results[2] as { data: { round_id: number }[] | null }).data
  const activeRoundsPerGame = results.slice(3) as Awaited<ReturnType<typeof getActiveRoundForGame>>[]

  const roundIds = (rounds ?? []).map((r: { id: number }) => r.id)
  const { data: matchesByRound } =
    roundIds.length > 0
      ? await supabase
          .from('matches')
          .select('round_id')
          .in('round_id', roundIds)
      : { data: [] }

  const typedRounds = (rounds ?? []) as { id: number; game_id: number; name: string; status: string; betting_closes_at: string | null }[]
  const now = new Date()

  const matchCountByRound = new Map<number, number>()
  for (const m of matchesByRound ?? []) {
    const rid = (m as { round_id: number }).round_id
    matchCountByRound.set(rid, (matchCountByRound.get(rid) ?? 0) + 1)
  }

  const activeRoundByGame = new Map<
    number,
    (typeof typedRounds)[0] & { matches_count: number; round_status: 'upcoming' | 'active' | 'finished' | null }
  >()
  for (let i = 0; i < rawGames.length; i++) {
    const round = activeRoundsPerGame[i] as Awaited<ReturnType<typeof getActiveRoundForGame>>
    if (round) {
      const fromCurrent = round.matches_count > 0 ? round.matches_count : null
      activeRoundByGame.set(rawGames[i].game!.id, {
        ...round,
        matches_count: fromCurrent ?? matchCountByRound.get(round.id) ?? 0,
        round_status: round.round_status ?? null,
      })
    }
  }

  const rankByGame = new Map<number, Map<string, number>>()
  const membersByGame = new Map<number, { user_id: string; points: number }[]>()
  for (const m of (allMembers ?? []) as { game_id: number; user_id: string; points: number }[]) {
    if (!membersByGame.has(m.game_id)) membersByGame.set(m.game_id, [])
    membersByGame.get(m.game_id)!.push(m)
  }
  for (const [gid, arr] of membersByGame) {
    const rankMap = new Map<string, number>()
    let rank = 1
    for (let i = 0; i < arr.length; i++) {
      if (i > 0 && arr[i].points < arr[i - 1].points) rank = i + 1
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

  const games: GameRow[] = rawGames.map((m) => {
    const g = m.game!
    const memberCount = (g.member_count as unknown as { count: number }[])[0]?.count ?? 0
    const activeRound = activeRoundByGame.get(g.id) ?? null
    const rank = rankByGame.get(g.id)?.get(user.id) ?? 1
    const bets_count = betsCountByGame.get(g.id) ?? 0

    return {
      points: m.points,
      rank,
      bets_count,
      game: {
        ...g,
        member_count: memberCount,
      } as Game & { member_count: number },
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

  const activeGames = games.filter((g) => g.game.status === 'active')
  const finishedGames = games.filter((g) => g.game.status === 'finished')
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
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
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

        {/* To-kolonne layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Venstre — spilrum */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest">Dine spilrum</h2>

            {activeGames.length === 0 && finishedGames.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/8 p-12 text-center">
                <p className="text-[#7a7060] mb-4">Du er ikke med i nogen spilrum endnu</p>
                <Link href="/games/new" className="inline-flex items-center gap-2 text-[#2C4A3E] font-['Barlow_Condensed'] font-bold text-sm uppercase hover:text-[#B8963E] transition-colors">
                  Opret dit første spil
                </Link>
              </div>
            ) : (
              <>
                {activeGames.map((row) => (
                  <DashboardGameCard key={row.game.id} row={row} />
                ))}
                {finishedGames.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">Afsluttede spil</h3>
                    <div className="flex flex-col gap-4 opacity-75">
                      {finishedGames.map((row) => (
                        <DashboardGameCard key={row.game.id} row={row} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Højre — live + join */}
          <div className="flex flex-col gap-4">
            <LiveSidebar rounds={activeRounds} nextRoundDate={nextRoundDate} />
            <JoinGameCard />
          </div>
        </div>
      </div>
    </div>
  )
}
