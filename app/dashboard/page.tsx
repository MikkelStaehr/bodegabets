import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await supabaseAdmin
    .from('game_members')
    .select(`
      game_id, earnings,
      games(
        id, name, status, invite_code,
        game_leagues(leagues(name, bold_slug))
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const gameIds = (memberships ?? []).map((m: { game_id: number }) => m.game_id)
  if (gameIds.length === 0) {
    return <DashboardClient displayName={profile?.username ?? 'Spiller'} games={[]} />
  }

  // Tæl antal members per game
  const memberCounts: Record<number, number> = {}
  const { data: countRows } = await supabaseAdmin
    .from('game_members')
    .select('game_id')
    .in('game_id', gameIds)
  for (const row of countRows ?? []) {
    memberCounts[row.game_id] = (memberCounts[row.game_id] ?? 0) + 1
  }

  // Hent rounds via game_leagues (rounds tilhører ligaer)
  const { data: gameLeagues } = await supabaseAdmin
    .from('game_leagues')
    .select('game_id, league_id')
    .in('game_id', gameIds)
  const leagueIds = [...new Set((gameLeagues ?? []).map((gl: { league_id: number }) => gl.league_id))]
  const leagueIdByGame = new Map((gameLeagues ?? []).map((gl: { game_id: number; league_id: number }) => [gl.game_id, gl.league_id]))

  const { data: rounds } = leagueIds.length > 0
    ? await supabaseAdmin
        .from('rounds')
        .select('id, league_id, name, status, betting_closes_at')
        .in('league_id', leagueIds)
        .neq('status', 'finished')
        .order('betting_closes_at', { ascending: false })
    : { data: [] }

  const roundsByLeague = new Map<number, { id: number; name: string; status: string; betting_closes_at: string | null }[]>()
  for (const r of rounds ?? []) {
    const lid = r.league_id as number
    if (!roundsByLeague.has(lid)) roundsByLeague.set(lid, [])
    roundsByLeague.get(lid)!.push({
      id: r.id as number,
      name: r.name as string,
      status: r.status as string,
      betting_closes_at: r.betting_closes_at as string | null,
    })
  }

  // Beregn rank per game (fra earnings)
  const { data: allMembers } = await supabaseAdmin
    .from('game_members')
    .select('game_id, user_id, earnings')
    .in('game_id', gameIds)
  const membersByGame = new Map<number, { user_id: string; earnings: number }[]>()
  for (const m of allMembers ?? []) {
    const gid = m.game_id as number
    if (!membersByGame.has(gid)) membersByGame.set(gid, [])
    membersByGame.get(gid)!.push({ user_id: m.user_id, earnings: m.earnings ?? 0 })
  }
  const rankByGame = new Map<number, number>()
  for (const [gid, arr] of membersByGame) {
    const sorted = [...arr].sort((a, b) => b.earnings - a.earnings)
    const idx = sorted.findIndex((e) => e.user_id === user.id)
    rankByGame.set(gid, idx >= 0 ? idx + 1 : 0)
  }

  const activeRoundIds = [...roundsByLeague.values()].flat().map((r) => r.id)
  const { data: userBets } = activeRoundIds.length > 0
    ? await supabaseAdmin.from('bets').select('round_id').eq('user_id', user.id).in('round_id', activeRoundIds)
    : { data: [] }
  const roundsWithBets = new Set((userBets ?? []).map((b: { round_id: number }) => b.round_id))

  const games = (memberships ?? []).map((m: Record<string, unknown>) => {
    const g = m.games as { id: number; name: string; status: string; invite_code: string; game_leagues?: { leagues?: { name: string } }[] } | undefined
    const leagueId = leagueIdByGame.get(m.game_id as number)
    const leagueRounds = leagueId ? roundsByLeague.get(leagueId) ?? [] : []
    const activeRound = leagueRounds.find((r) => r.status === 'open')
      ?? leagueRounds.find((r) => r.status === 'upcoming')
      ?? leagueRounds[0]
      ?? null

    return {
      id: g?.id,
      name: g?.name ?? '',
      status: g?.status ?? 'active',
      invite_code: g?.invite_code ?? '',
      league_name: (g?.game_leagues as { leagues?: { name: string } }[] | undefined)?.[0]?.leagues?.name ?? '',
      rank: rankByGame.get(m.game_id as number) ?? null,
      member_count: memberCounts[m.game_id as number] ?? 1,
      active_round: activeRound
        ? { ...activeRound, bets_submitted: roundsWithBets.has(activeRound.id) }
        : null,
    }
  })

  const displayName = profile?.username ?? 'Spiller'

  return <DashboardClient displayName={displayName} games={games} />
}
