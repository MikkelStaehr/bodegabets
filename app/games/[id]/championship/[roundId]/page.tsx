import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import AfgivBets from '@/components/games/AfgivBets'
import type { Match, Bet } from '@/types'

type Props = {
  params: Promise<{ id: string; roundId: string }>
}

type MatchRow = Match

type RawMatch = {
  id: number
  kickoff_at: string | null
  status: string
  result: string | null
  bet_open: boolean
  second_half_started_at: string | null
  home_score: number | null
  away_score: number | null
  home_team: { id: number; name: string; logo_url: string | null } | null
  away_team: { id: number; name: string; logo_url: string | null } | null
}

export default async function ChampionshipRoundPage({ params }: Props) {
  const { id, roundId } = await params
  const gameId = parseInt(id)
  const roundIdNum = parseInt(roundId)
  if (isNaN(gameId) || isNaN(roundIdNum)) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hent game og membership parallelt
  const [{ data: game }, { data: membership }] = await Promise.all([
    supabaseAdmin
      .from('games')
      .select('id, name, status, championship_mode')
      .eq('id', gameId)
      .single(),
    supabaseAdmin
      .from('game_members')
      .select('earnings')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!game) notFound()
  if (!game.championship_mode) notFound()
  if (!membership) redirect(`/games/${gameId}`)

  // Hent championship round
  const { data: round } = await supabaseAdmin
    .from('championship_rounds')
    .select('id, name, status, betting_closes_at')
    .eq('id', roundIdNum)
    .single()

  if (!round) notFound()

  // Hent kampe via championship_round_matches → matches
  const { data: roundMatchRows } = await supabaseAdmin
    .from('championship_round_matches')
    .select(`
      match_id,
      matches(
        id, kickoff_at:kickoff, status, result, bet_open, second_half_started_at,
        home_score, away_score,
        home_team:teams!home_team_id(id, name, logo_url),
        away_team:teams!away_team_id(id, name, logo_url)
      )
    `)
    .eq('championship_round_id', roundIdNum)

  function toMatchRow(raw: RawMatch): MatchRow {
    return {
      id: raw.id,
      home_team: raw.home_team?.name ?? 'Ukendt',
      away_team: raw.away_team?.name ?? 'Ukendt',
      kickoff_at: raw.kickoff_at ?? '',
      home_score: raw.home_score,
      away_score: raw.away_score,
      home_score_ht: null,
      away_score_ht: null,
      status: raw.status as MatchRow['status'],
      home_team_logo: raw.home_team?.logo_url ?? null,
      away_team_logo: raw.away_team?.logo_url ?? null,
      bet_open: raw.bet_open,
      second_half_started_at: raw.second_half_started_at,
      round_id: roundIdNum,
    }
  }

  const matches = (roundMatchRows ?? [])
    .filter((rm) => rm.matches)
    .map((rm) => toMatchRow(rm.matches as unknown as RawMatch))
    .sort((a, b) => (a.kickoff_at ?? '').localeCompare(b.kickoff_at ?? ''))

  // Hent brugerens eksisterende bets
  const matchIds = matches.map((m) => m.id)
  const { data: betsData } = await supabaseAdmin
    .from('bets')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .in('match_id', matchIds.length > 0 ? matchIds : [0])

  const typedBets = (betsData ?? []) as Bet[]

  // Bet-fordeling for låste kampe
  const lockedMatchIds = matches.filter((m) => !m.bet_open).map((m) => m.id)
  const { data: distributionData } = await supabaseAdmin
    .from('bets')
    .select('match_id, prediction, odds')
    .eq('game_id', gameId)
    .eq('bet_type', 'match_result')
    .in('match_id', lockedMatchIds.length > 0 ? lockedMatchIds : [0])

  type DistEntry = { '1': number; 'X': number; '2': number; total: number; odds: { '1': number | null; 'X': number | null; '2': number | null } }
  const betDistribution: Record<number, DistEntry> = {}
  for (const bet of distributionData ?? []) {
    if (!betDistribution[bet.match_id]) {
      betDistribution[bet.match_id] = { '1': 0, 'X': 0, '2': 0, total: 0, odds: { '1': null, 'X': null, '2': null } }
    }
    if (bet.prediction === '1' || bet.prediction === 'X' || bet.prediction === '2') {
      betDistribution[bet.match_id][bet.prediction as '1' | 'X' | '2']++
      betDistribution[bet.match_id].total++
      if (betDistribution[bet.match_id].odds[bet.prediction as '1' | 'X' | '2'] === null && (bet as { odds?: number | null }).odds != null) {
        betDistribution[bet.match_id].odds[bet.prediction as '1' | 'X' | '2'] = (bet as { odds?: number | null }).odds!
      }
    }
  }

  // Rivalries
  const rivalryInfo: Record<number, { rivalry_name: string; multiplier: number }> = {}
  if (matchIds.length > 0) {
    const { data: matchTeamRows } = await supabaseAdmin
      .from('matches')
      .select('id, home_team_id, away_team_id')
      .in('id', matchIds)

    const allTeamIds = [...new Set(
      (matchTeamRows ?? [])
        .flatMap((m) => [m.home_team_id, m.away_team_id])
        .filter((tid): tid is number => tid != null)
    )]

    if (allTeamIds.length > 0) {
      const { data: rivalries } = await supabaseAdmin
        .from('rivalries')
        .select('team_id, rival_team_id, rivalry_name, multiplier')
        .in('team_id', allTeamIds)
        .in('rival_team_id', allTeamIds)

      if (rivalries?.length) {
        const rivalryPairs = new Map<string, { rivalry_name: string; multiplier: number }>()
        for (const r of rivalries) {
          const info = { rivalry_name: r.rivalry_name, multiplier: Number(r.multiplier) }
          rivalryPairs.set(`${r.team_id}:${r.rival_team_id}`, info)
          rivalryPairs.set(`${r.rival_team_id}:${r.team_id}`, info)
        }
        for (const m of matchTeamRows ?? []) {
          if (m.home_team_id != null && m.away_team_id != null) {
            const rivalry = rivalryPairs.get(`${m.home_team_id}:${m.away_team_id}`)
            if (rivalry) rivalryInfo[m.id] = rivalry
          }
        }
      }
    }
  }

  // Ticker
  const tickerItems: string[] = []
  const roundStatus = round.betting_closes_at && new Date(round.betting_closes_at) > new Date() ? 'open' : round.status
  if (round.betting_closes_at && roundStatus === 'open') {
    const dl = new Date(round.betting_closes_at)
    const dlStr = dl.toLocaleString('da-DK', {
      timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    tickerItems.push(`Bets til ${round.name} er åbne — deadline ${dlStr}`)
  }
  tickerItems.push(`${(game as { name: string }).name} · ${round.name}`)

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
        name: round.name,
        betting_closes_at: round.betting_closes_at,
        status: roundStatus,
      }}
      matches={matches}
      existingBets={typedBets}
      userPoints={1000}
      tickerItems={tickerItems}
      rivalryInfo={rivalryInfo}
      totalMatchesInRound={matches.length}
      betDistribution={betDistribution}
      blockInfo={null}
      submitApiPath={`/api/championship/${roundIdNum}/submit-bets`}
    />
  )
}
