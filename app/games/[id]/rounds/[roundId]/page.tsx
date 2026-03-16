import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import AfgivBets from '@/components/AfgivBets'
import { syncMatchesForRound } from '@/lib/syncMatchesForRound'
import type { Match, Bet, Round } from '@/types'

type Props = {
  params: Promise<{ id: string; roundId: string }>
}

type MatchRow = Match

function formatDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
  if (isMidnight) {
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  }
  return d.toLocaleString('da-DK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function RoundPage({ params }: Props) {
  const { id, roundId } = await params
  const gameId = parseInt(id)
  const roundIdNum = parseInt(roundId)
  if (isNaN(gameId) || isNaN(roundIdNum)) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: game } = await supabase
    .from('games')
    .select('id, name, status')
    .eq('id', gameId)
    .single()

  if (!game) notFound()

  // Hent season_ids for dette game via game_seasons
  const { data: gameSeasons } = await supabase
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)
  const seasonIds = (gameSeasons ?? []).map(gs => gs.season_id as number)

  const [
    { data: round },
    { data: membership },
    { data: rawMatches },
  ] = await Promise.all([
    supabase
      .from('rounds')
      .select('id, name, status, betting_closes_at, season_id')
      .eq('id', roundIdNum)
      .in('season_id', seasonIds.length > 0 ? seasonIds : [0])
      .single(),

    supabase
      .from('game_members')
      .select('earnings')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle(),

    supabase
      .from('matches')
      .select(`
        id, round_id, home_team, away_team, kickoff_at,
        home_score, away_score, home_score_ht, away_score_ht, status
      `)
      .eq('round_id', roundIdNum)
      .order('kickoff_at', { ascending: true }),
  ])

  if (!round) notFound()
  if (!membership) redirect(`/games/${gameId}`)

  let matches = (rawMatches ?? []) as unknown as MatchRow[]

  if (matches.length === 0) {
    await syncMatchesForRound(supabaseAdmin, gameId, roundIdNum)
    const { data: matchesRetry } = await supabase
      .from('matches')
      .select(`
        id, round_id, home_team, away_team, kickoff_at,
        home_score, away_score, home_score_ht, away_score_ht, status
      `)
      .eq('round_id', roundIdNum)
      .order('kickoff_at', { ascending: true })
    matches = (matchesRetry ?? []) as unknown as MatchRow[]
  }

  // Hent betting_balance fra round_members
  const { data: roundMember } = await supabase
    .from('round_members')
    .select('betting_balance')
    .eq('user_id', user.id)
    .eq('round_id', roundIdNum)
    .eq('game_id', gameId)
    .single()

  const bettingBalance = roundMember?.betting_balance ?? 0

  const typedRound = round as unknown as Round
  const matchIds = matches.map((m) => m.id)

  const { data: betsData } = await supabase
    .from('bets')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .in('match_id', matchIds.length > 0 ? matchIds : [0])

  const typedBets = (betsData ?? []) as Bet[]

  // Hent rivalries via season → tournament → league
  const rivalryInfo: Record<number, { rivalry_name: string; multiplier: number }> = {}
  if (round.season_id) {
    // Hent tournament_id fra seasons
    const { data: season } = await supabase
      .from('seasons')
      .select('tournament_id')
      .eq('id', round.season_id)
      .single()

    // Brug tournament_id som league_id (de mapper 1:1 i rivalries)
    const tournamentId = season?.tournament_id
    if (tournamentId) {
      const { data: rivalries } = await supabase
        .from('rivalries')
        .select('home_team, away_team, rivalry_name, multiplier')
        .eq('league_id', tournamentId)

      if (rivalries) {
        const rivalryLookup = new Map<string, { rivalry_name: string; multiplier: number }>()
        for (const r of rivalries) {
          const info = { rivalry_name: r.rivalry_name, multiplier: Number(r.multiplier) }
          rivalryLookup.set(`${r.home_team}|${r.away_team}`, info)
          rivalryLookup.set(`${r.away_team}|${r.home_team}`, info)
        }
        for (const m of matches) {
          const rivalry = rivalryLookup.get(`${m.home_team}|${m.away_team}`)
          if (rivalry) rivalryInfo[m.id] = rivalry
        }
      }
    }
  }

  // Ticker items for round page
  const tickerItems: string[] = []
  if (typedRound.betting_closes_at && typedRound.status === 'open') {
    tickerItems.push(
      `🔓 Bets til ${typedRound.name} er åbne — deadline ${formatDate(typedRound.betting_closes_at)}`
    )
  }
  tickerItems.push(`🏟 ${(game as { name: string }).name} · ${typedRound.name}`)

  if (matches.length === 0) {
    return (
      <div className="min-h-screen bg-[#F2EDE4] flex flex-col items-center justify-center p-8 gap-4">
        <p className="font-body text-[#7a7060] text-center">
          Kampe for denne runde er ikke klar endnu.
        </p>
        <Link
          href={`/games/${gameId}`}
          className="text-sm text-[#1e2a1e] underline underline-offset-4"
        >
          ← Tilbage til spilrum
        </Link>
      </div>
    )
  }

  return (
    <AfgivBets
      gameId={gameId}
      roundId={roundIdNum}
      gameName={(game as { name: string }).name}
      round={{
        name: typedRound.name,
        betting_closes_at: typedRound.betting_closes_at,
        status: typedRound.status,
      }}
      matches={matches}
      existingBets={typedBets}
      userPoints={bettingBalance}
      tickerItems={tickerItems}
      rivalryInfo={rivalryInfo}
      totalMatchesInRound={matches.length}
    />
  )
}
