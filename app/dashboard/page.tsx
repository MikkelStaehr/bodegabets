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
      games(id, name, status, invite_code)
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

  // Hent rounds via game_seasons (rounds tilhører sæsoner)
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('game_id, season_id')
    .in('game_id', gameIds)
  const seasonIds = [...new Set((gameSeasons ?? []).map((gs: { season_id: number }) => gs.season_id))]
  const seasonIdByGame = new Map((gameSeasons ?? []).map((gs: { game_id: number; season_id: number }) => [gs.game_id, gs.season_id]))

  const { data: rounds } = seasonIds.length > 0
    ? await supabaseAdmin
        .from('rounds')
        .select('id, season_id, name, status, betting_closes_at')
        .in('season_id', seasonIds)
        .neq('status', 'finished')
        .order('betting_closes_at', { ascending: false })
    : { data: [] }

  const roundsBySeason = new Map<number, { id: number; name: string; status: string; betting_closes_at: string | null }[]>()
  for (const r of rounds ?? []) {
    const sid = r.season_id as number
    if (!roundsBySeason.has(sid)) roundsBySeason.set(sid, [])
    roundsBySeason.get(sid)!.push({
      id: r.id as number,
      name: r.name as string,
      status: r.status as string,
      betting_closes_at: r.betting_closes_at as string | null,
    })
  }

  const { data: seasonRows } = seasonIds.length > 0
    ? await supabaseAdmin
        .from('seasons')
        .select('id, tournament_id, tournaments(name)')
        .in('id', seasonIds)
    : { data: [] }
  const leagueNameBySeason = new Map<number, string>()
  for (const s of seasonRows ?? []) {
    const t = (s as { tournaments?: { name?: string } | { name?: string }[] }).tournaments
    leagueNameBySeason.set(s.id as number, (Array.isArray(t) ? t[0] : t)?.name ?? '')
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

  const activeRoundIds = [...roundsBySeason.values()].flat().map((r) => r.id)
  const { data: userBets } = activeRoundIds.length > 0
    ? await supabaseAdmin.from('bets').select('round_id').eq('user_id', user.id).in('round_id', activeRoundIds)
    : { data: [] }
  const roundsWithBets = new Set((userBets ?? []).map((b: { round_id: number }) => b.round_id))

  const games = (memberships ?? []).map((m: Record<string, unknown>) => {
    const g = m.games as { id: number; name: string; status: string; invite_code: string } | undefined
    const seasonId = seasonIdByGame.get(m.game_id as number)
    const leagueRounds = seasonId ? roundsBySeason.get(seasonId) ?? [] : []
    const activeRound = leagueRounds.find((r) => r.status === 'open')
      ?? leagueRounds.find((r) => r.status === 'upcoming')
      ?? leagueRounds[0]
      ?? null

    return {
      id: g?.id,
      name: g?.name ?? '',
      status: g?.status ?? 'active',
      invite_code: g?.invite_code ?? '',
      league_name: seasonId ? leagueNameBySeason.get(seasonId) ?? '' : '',
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
