import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { getLosersLuckUserIds } from '@/lib/losersLuck'
import AfgivBets from '@/components/games/AfgivBets'
import BlockBetsPanel from '@/components/games/BlockBetsPanel'
import type { Match, Bet, Round } from '@/types'

type Props = {
  params: Promise<{ id: string; roundId: string }>
}

type MatchRow = Match


export default async function RoundPage({ params }: Props) {
  const { id, roundId } = await params
  const gameId = parseInt(id)
  const roundIdNum = parseInt(roundId)
  if (isNaN(gameId) || isNaN(roundIdNum)) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name, status')
    .eq('id', gameId)
    .single()

  if (!game) notFound()

  // Hent season_ids for dette game via game_seasons
  const { data: gameSeasons } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)
  const seasonIds = (gameSeasons ?? []).map(gs => gs.season_id as number)

  // Step 1: Hent round og membership parallelt
  const [{ data: round }, { data: membership }] = await Promise.all([
    supabaseAdmin
      .from('rounds')
      .select('id, name, season_id, status, betting_closes_at, bet_open, block_id')
      .eq('id', roundIdNum)
      .in('season_id', seasonIds.length > 0 ? seasonIds : [0])
      .single(),

    supabaseAdmin
      .from('game_members')
      .select('earnings')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!round) notFound()
  if (!membership) redirect(`/games/${gameId}`)

  // Slutrunde-credit-model: 1250 credits PR. BLOK (delt over blokkens 2 runder + Blok Bets)
  // i stedet for pr. runde. Kun aktivt for sæsoner med credits_per_block (VM).
  const roundSeasonId = (round as typeof round & { season_id: number }).season_id
  const { data: seasonRow } = await supabaseAdmin
    .from('seasons')
    .select('credits_per_block')
    .eq('id', roundSeasonId)
    .single()
  const creditsPerBlock = (seasonRow as { credits_per_block?: boolean } | null)?.credits_per_block === true

  // Runder spillet under den GAMLE pr-runde-adfærd tæller ikke mod blok-budgettet.
  // 36175: VM-åbningskampen (før blok-systemet). 36177: blok 11's dag 1 — runde 2's
  // kupon åbnede først dagen efter, så dag 2 får sit eget friske 1000.
  const LEGACY_PRE_BLOCK_ROUND_IDS = [36175, 36177]

  // Hent block info hvis runden er tilknyttet en block.
  //
  // VM (credits_per_block): HELE blokkens kampe vises på ÉN kupon, delt på dage
  // — så hele blokken kan udfyldes på forhånd. Budgettet er fælles for blokken,
  // og da alle blokkens bets nu ligger på samme kupon (via existingBets), er der
  // intet "spent elsewhere" at trække fra (= 0). Almindelige spil: kun denne runde.
  const roundBlockId = (round as typeof round & { block_id?: number | null }).block_id ?? null
  let blockInfo: { block_number: number; block_name: string; is_last_in_block: boolean } | null = null
  let couponRoundIds: number[] = [roundIdNum]
  // Blok bets deler blokkens samlede budget (1250) med kamp-bets. Da blok bets
  // placeres separat (eget panel), behandles deres indsats som "allerede brugt"
  // når kamp-kuponens rådige credits beregnes. Sættes nedenfor.
  let blockSpentElsewhere = 0
  if (roundBlockId) {
    const [{ data: block }, { data: blockRounds }] = await Promise.all([
      supabaseAdmin.from('blocks').select('id, block_number, name').eq('id', roundBlockId).single(),
      supabaseAdmin.from('rounds').select('id').eq('block_id', roundBlockId).order('id', { ascending: true }),
    ])
    if (block) {
      const allBlockRoundIds = (blockRounds ?? []).map((r: { id: number }) => r.id)
      const isLast = allBlockRoundIds.length > 0 && allBlockRoundIds[allBlockRoundIds.length - 1] === roundIdNum
      blockInfo = { block_number: block.block_number, block_name: block.name, is_last_in_block: isLast }

      // Slå hele blokkens kampe sammen på kuponen (ekskl. legacy-runder, der blev
      // spillet under den gamle pr-runde-adfærd og har eget budget).
      if (creditsPerBlock) {
        couponRoundIds = allBlockRoundIds.filter((rid) => !LEGACY_PRE_BLOCK_ROUND_IDS.includes(rid))
        if (!couponRoundIds.includes(roundIdNum)) couponRoundIds.push(roundIdNum)
      }
    }
  }

  // 🍀 Losers Luck: er den aktuelle spiller blandt de nederste (boost i blokken)?
  const losersLuckActive = (await getLosersLuckUserIds(gameId, roundBlockId)).has(user.id)

  // Step 2: Hent matches for kuponens runder (blokken for VM, ellers denne runde)
  const matchSelect = `
    id, round_id, kickoff_at:kickoff, status, result, bet_open, second_half_started_at,
    home_score, away_score,
    home_team:teams!home_team_id(id, name, logo_url),
    away_team:teams!away_team_id(id, name, logo_url)
  `

  type RawMatch = {
    id: number
    round_id: number
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
      round_id: raw.round_id,
    }
  }

  const { data: rawMatches, error: matchesError } = await supabaseAdmin
    .from('matches')
    .select(matchSelect)
    .in('round_id', couponRoundIds)
    .order('kickoff', { ascending: true })

  const matches = (rawMatches ?? []).map((m) => toMatchRow(m as unknown as RawMatch))


  // Hent betting_balance fra round_members
  const { data: roundMember } = await supabaseAdmin
    .from('round_members')
    .select('betting_balance')
    .eq('user_id', user.id)
    .eq('round_id', roundIdNum)
    .eq('game_id', gameId)
    .single()

  const bettingBalance = roundMember?.betting_balance ?? 0

  const typedRound = round as unknown as Round
  const matchIds = matches.map((m) => m.id)

  const { data: betsData } = await supabaseAdmin
    .from('bets')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .in('match_id', matchIds.length > 0 ? matchIds : [0])

  const typedBets = (betsData ?? []) as Bet[]

  // Blok Bets — brugerens placerede + om de stadig kan placeres (blokken er
  // ikke gået i gang). Deler blokkens 1250-budget med kamp-bets.
  let blockBetsProps:
    | { blockId: number; blockName: string; matchCount: number; initialBets: { market_key: string; selection: string; stake: number; odds?: number }[]; placeable: boolean; spentOnMatches: number }
    | null = null
  if (creditsPerBlock && roundBlockId && blockInfo) {
    const { data: bbets } = await supabaseAdmin
      .from('block_bets').select('market_key, selection, stake, odds')
      .eq('game_id', gameId).eq('user_id', user.id).eq('block_id', roundBlockId)
    // Blok-bet-indsats tæller mod det fælles budget → træk fra kamp-kuponen.
    blockSpentElsewhere = (bbets ?? []).reduce((s, b) => s + ((b.stake as number) ?? 0), 0)
    const earliest = [...matches].sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)))[0]
    blockBetsProps = {
      blockId: roundBlockId,
      blockName: blockInfo.block_name ?? `Blok ${blockInfo.block_number}`,
      matchCount: matches.length,
      initialBets: (bbets ?? []).map((b) => ({ market_key: b.market_key as string, selection: b.selection as string, stake: b.stake as number, odds: b.odds as number | undefined })),
      placeable: (earliest?.bet_open ?? false) === true,
      spentOnMatches: typedBets.reduce((s, b) => s + (b.stake ?? 0), 0),
    }
  }

  // Hent bet-fordeling for låste kampe
  const lockedMatchIds = matches.filter(m => !m.bet_open).map(m => m.id)
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

  // Hent rivalries via team IDs
  const rivalryInfo: Record<number, { rivalry_name: string; multiplier: number }> = {}
  if (matchIds.length > 0) {
    const { data: matchTeamRows } = await supabaseAdmin
      .from('matches')
      .select('id, home_team_id, away_team_id')
      .in('id', matchIds)

    const allTeamIds = [...new Set(
      (matchTeamRows ?? [])
        .flatMap((m) => [m.home_team_id, m.away_team_id])
        .filter((id): id is number => id != null)
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

  // Ticker items
  const tickerItems: string[] = []
  if (typedRound.betting_closes_at && typedRound.status === 'open') {
    const dl = new Date(typedRound.betting_closes_at)
    const dlStr = dl.toLocaleString('da-DK', {
      timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    tickerItems.push(`Bets til ${typedRound.name} er åbne — deadline ${dlStr}`)
  }
  tickerItems.push(`${(game as { name: string }).name} · ${typedRound.name}`)

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
    <div className="min-h-screen bg-[var(--color-cream)]">
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
      betDistribution={betDistribution}
      blockInfo={blockInfo}
      blockBudget={1250}
      blockSpentElsewhere={blockSpentElsewhere}
      creditsRollOver={false}
      losersLuckActive={losersLuckActive}
      blockBets={blockBetsProps && <BlockBetsPanel gameId={gameId} {...blockBetsProps} />}
    />
    </div>
  )
}
