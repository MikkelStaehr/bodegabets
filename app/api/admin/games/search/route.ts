import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 3) {
    return NextResponse.json({ error: 'Min 3 tegn' }, { status: 400 })
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
    return NextResponse.json({ notFound: true })
  }

  const game = games[0]
  const gameId = game.id as number

  // Hent league_id via game_leagues junction table
  const { data: gameLeague } = await supabaseAdmin
    .from('game_leagues')
    .select('league_id')
    .eq('game_id', gameId)
    .limit(1)
    .single()

  const leagueId = gameLeague?.league_id as number | null

  const [
    { data: league },
    { data: members },
    { data: rounds },
  ] = await Promise.all([
    leagueId
      ? supabaseAdmin.from('leagues').select('name').eq('id', leagueId).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('game_members')
      .select(`
        user_id,
        profile:profiles(username)
      `)
      .eq('game_id', gameId),
    leagueId
      ? supabaseAdmin
          .from('rounds')
          .select('id, name, status')
          .eq('league_id', leagueId)
          .order('betting_closes_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

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

  return NextResponse.json({
    game: {
      id: game.id,
      name: game.name,
      invite_code: game.invite_code,
      status: game.status,
      created_at: game.created_at,
      league_name: (league as { name?: string })?.name ?? '—',
      member_count: (members ?? []).length,
      current_round_name: currentRoundName,
      total_bets: totalBets,
      members: ranked,
    },
  })
}
