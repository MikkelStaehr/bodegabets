import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import AfgivBets from '@/components/AfgivBets'
import { syncMatchesForRound } from '@/lib/syncMatchesForRound'
import type { Match, Bet, Round, MatchSidebetOption } from '@/types'

type Props = {
  params: Promise<{ id: string; roundId: string }>
}

type MatchRow = Match & { sidebet_options: MatchSidebetOption[] }

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

  const [
    { data: round },
    { data: game },
    { data: membership },
    { data: rawMatches },
  ] = await Promise.all([
    supabase
      .from('rounds')
      .select('id, name, stage, status, betting_opens_at, betting_closes_at, game_id, extra_bets_enabled')
      .eq('id', roundIdNum)
      .eq('game_id', gameId)
      .single(),

    supabase
      .from('games')
      .select('id, name, status')
      .eq('id', gameId)
      .single(),

    supabase
      .from('game_members')
      .select('points, betting_balance')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle(),

    supabase
      .from('matches')
      .select(`
        id, round_id, home_team, away_team, kickoff_at, betting_closes_at,
        home_score, away_score, home_ht_score, away_ht_score,
        yellow_cards, red_cards, first_scorer,
        odds_home, odds_draw, odds_away, status, source_url,
        sidebet_options:match_sidebet_options(id, match_id, bet_type)
      `)
      .eq('round_id', roundIdNum)
      .order('kickoff_at', { ascending: true }),
  ])

  if (!round || !game) notFound()
  if (!membership) redirect(`/games/${gameId}`)

  let matches = (rawMatches ?? []) as unknown as MatchRow[]

  if (matches.length === 0) {
    await syncMatchesForRound(supabaseAdmin, gameId, roundIdNum)
    const { data: matchesRetry } = await supabase
      .from('matches')
      .select(`
        id, round_id, home_team, away_team, kickoff_at, betting_closes_at,
        home_score, away_score, home_ht_score, away_ht_score,
        yellow_cards, red_cards, first_scorer,
        odds_home, odds_draw, odds_away, status, source_url,
        sidebet_options:match_sidebet_options(id, match_id, bet_type)
      `)
      .eq('round_id', roundIdNum)
      .order('kickoff_at', { ascending: true })
    matches = (matchesRetry ?? []) as unknown as MatchRow[]
  }

  const typedRound = round as Round
  const matchIds = matches.map((m) => m.id)

  const { data: betsData } = await supabase
    .from('bets')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .in('match_id', matchIds.length > 0 ? matchIds : [0])

  const typedBets = (betsData ?? []) as Bet[]

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
        stage: typedRound.stage,
        betting_closes_at: typedRound.betting_closes_at,
        status: typedRound.status,
        extra_bets_enabled: (typedRound as { extra_bets_enabled?: boolean }).extra_bets_enabled,
      }}
      matches={matches}
      existingBets={typedBets}
      userPoints={(membership as { betting_balance?: number }).betting_balance ?? membership.points ?? 1000}
      tickerItems={tickerItems}
    />
  )
}
