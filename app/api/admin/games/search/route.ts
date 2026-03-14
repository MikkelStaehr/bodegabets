import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''

  // Tom søgning: returner alle spilrum som liste
  if (!q || q.length < 3) {
    const { data: gamesRows } = await supabaseAdmin
      .from('games')
      .select('id, name, invite_code, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (!gamesRows?.length) {
      return NextResponse.json({ games: [] })
    }

    const gameIds = gamesRows.map((g) => g.id)
    const { data: memberCounts } = await supabaseAdmin
      .from('game_members')
      .select('game_id')
      .in('game_id', gameIds)

    const countByGame = new Map<number, number>()
    for (const m of memberCounts ?? []) {
      const gid = (m as { game_id: number }).game_id
      countByGame.set(gid, (countByGame.get(gid) ?? 0) + 1)
    }

    const games = gamesRows.map((g) => ({
      id: g.id,
      name: g.name,
      invite_code: g.invite_code,
      status: g.status,
      member_count: countByGame.get(g.id) ?? 0,
    }))

    return NextResponse.json({ games })
  }

  const qUpper = q.toUpperCase()
  const qPattern = `%${q}%`

  // Søg først på eksakt invite_code, ellers partial match på name
  let games: { id: number; name: string; invite_code: string; status: string; created_at: string }[] | null
  const { data: byCode } = await supabaseAdmin
    .from('games')
    .select('id, name, invite_code, status, created_at')
    .eq('invite_code', qUpper)
    .limit(1)
  if (byCode?.length) {
    games = byCode
  } else {
    const { data: byName } = await supabaseAdmin
      .from('games')
      .select('id, name, invite_code, status, created_at')
      .ilike('name', qPattern)
      .limit(5)
    games = byName
  }

  if (!games?.length) {
    return NextResponse.json({ notFound: true, games: [] })
  }

  const game = games[0]
  const gameId = game.id as number

  // Hent season_id via game_seasons junction table
  const { data: gameSeason } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)
    .limit(1)
    .single()

  const seasonId = gameSeason?.season_id as number | null

  const [
    { data: tournamentData },
    { data: members },
    { data: rounds },
  ] = await Promise.all([
    seasonId
      ? supabaseAdmin.from('seasons').select('tournament_id, tournaments(name)').eq('id', seasonId).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('game_members')
      .select(`
        user_id,
        profile:profiles(username)
      `)
      .eq('game_id', gameId),
    seasonId
      ? supabaseAdmin
          .from('rounds')
          .select('id, name, status')
          .eq('season_id', seasonId)
          .order('betting_closes_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const t = tournamentData?.tournaments
  const leagueName = (Array.isArray(t) ? t[0] : t) as { name?: string } | undefined

  // Find current round: latest non-finished round, or last round overall
  const currentRoundMatch = (rounds ?? []).find((r: { status: string }) =>
    r.status === 'open' || r.status === 'upcoming'
  )
  const currentRoundName =
    currentRoundMatch?.name ??
    (rounds?.length ? (rounds as { name: string }[])[(rounds as unknown[]).length - 1]?.name : null) ??
    '—'

  let totalBets = 0
  const roundForBets = currentRoundMatch ?? (rounds ?? []).find((r: { status: string }) => r.status === 'open')
  if (roundForBets) {
    const { data: matchRows } = await supabaseAdmin.from('matches').select('id').eq('round_id', roundForBets.id)
    const matchIds = (matchRows ?? []).map((m: { id: number }) => m.id)
    const { count } = matchIds.length
      ? await supabaseAdmin.from('bets').select('*', { count: 'exact', head: true }).in('match_id', matchIds)
      : { count: 0 }
    totalBets = count ?? 0
  }

  const ranked = (members ?? []).map((m: { user_id: string; profile?: { username?: string } | { username?: string }[] }, i: number) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
    return {
      id: m.user_id,
      username: (p as { username?: string })?.username ?? '—',
      rank: i + 1,
    }
  })

  const memberCountsForList =
    games!.length > 1
      ? await (async () => {
          const { data: mc } = await supabaseAdmin
            .from('game_members')
            .select('game_id')
            .in('game_id', games!.map((g) => g.id))
          const map = new Map<number, number>()
          for (const r of mc ?? []) {
            const gid = (r as { game_id: number }).game_id
            map.set(gid, (map.get(gid) ?? 0) + 1)
          }
          return map
        })()
      : new Map([[game.id, (members ?? []).length]])

  return NextResponse.json({
    game: {
      id: game.id,
      name: game.name,
      invite_code: game.invite_code,
      status: game.status,
      created_at: game.created_at,
      league_name: leagueName?.name ?? '—',
      member_count: (members ?? []).length,
      current_round_name: currentRoundName,
      total_bets: totalBets,
      members: ranked,
    },
    games: games!.map((g) => ({
      id: g.id,
      name: g.name,
      invite_code: g.invite_code,
      status: g.status,
      member_count: memberCountsForList.get(g.id) ?? 0,
    })),
  })
}
