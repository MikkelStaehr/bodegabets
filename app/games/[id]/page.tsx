import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import { LiveMatchesProvider } from '@/contexts/LiveMatchesContext'
import GameTicker from '@/components/GameTicker'
import ActiveRoundLiveTicker from '@/components/ActiveRoundLiveTicker'
import RoundSlider from '@/components/games/RoundSlider'
import type { Game, Round, RoundScore } from '@/types'

type Props = {
  params: Promise<{ id: string }>
}

type MemberRow = {
  user_id: string
  points: number
  profile: { username: string } | null
}

type RoundScoreMap = Record<string, Record<number, number>>

function assignRanks<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  return rows.map((row, i, arr) => ({
    ...row,
    rank:
      i === 0
        ? 1
        : row.points === arr[i - 1].points
        ? (arr[i - 1] as T & { rank: number }).rank
        : i + 1,
  }))
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
  if (isMidnight) {
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  }
  return d.toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Beregn dynamisk rundestatus baseret på betting_closes_at og DB-status
function computeRoundStatus(round: Round, now: Date): 'upcoming' | 'open' | 'active' | 'finished' {
  if (round.status === 'finished') return 'finished'
  if (!round.betting_closes_at) return 'upcoming'
  const closes = new Date(round.betting_closes_at)
  if (closes > now) return 'open'     // bets accepteres stadig
  return 'active'                      // kampe i gang, ikke alle færdige
}

export default async function GamePage({ params }: Props) {
  const { id } = await params
  const gameId = parseInt(id)
  if (isNaN(gameId)) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hent game først for at finde league_id
  const { data: game } = await supabase
    .from('games')
    .select('id, name, description, host_id, invite_code, status, created_at, league_id')
    .eq('id', gameId)
    .single()

  if (!game) notFound()
  console.log('[DEBUG1] game:', game?.id, 'league_id:', (game as any)?.league_id)
  const gameLeagueId = (game as { league_id?: number }).league_id

  const [
    { data: rawMembers },
    { data: rounds },
    { data: roundScores },
    { data: myMembership },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('game_members')
      .select('user_id, points, profile:profiles(username)')
      .eq('game_id', gameId)
      .order('points', { ascending: false }),

    gameLeagueId
      ? supabase
          .from('rounds')
          .select('id, name, stage, status, betting_opens_at, betting_closes_at')
          .eq('league_id', gameLeagueId)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),

    supabase
      .from('round_scores')
      .select('user_id, round_id, points_earned')
      .eq('game_id', gameId),

    supabase
      .from('game_members')
      .select('user_id')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle(),

    supabase
      .from('profiles')
      .select('username, points, is_admin')
      .eq('id', user.id)
      .single(),
  ])

  console.log('[DEBUG2] gameLeagueId:', gameLeagueId, '| rounds:', rounds?.length ?? 'null', '| membership:', !!myMembership)

  if (!myMembership) redirect('/dashboard')

  const leagueId = (game as { league_id?: number }).league_id ?? null
  const { data: currentRound } =
    leagueId != null
      ? await supabase
          .from('current_rounds')
          .select('round_name, round_status, first_kickoff, last_kickoff, next_kickoff')
          .eq('league_id', leagueId)
          .single()
      : { data: null }

  const typedRoundsEarly = (rounds ?? []) as Round[]
  const activeRoundEarly = currentRound?.round_name
    ? typedRoundsEarly.find((r) => r.name === currentRound.round_name) ?? null
    : typedRoundsEarly.find((r) => computeRoundStatus(r, new Date()) === 'open') ??
      typedRoundsEarly.find((r) => computeRoundStatus(r, new Date()) === 'active') ??
      typedRoundsEarly.find((r) => computeRoundStatus(r, new Date()) === 'upcoming') ??
      null
  const latestFinishedEarly = [...typedRoundsEarly]
    .filter((r) => computeRoundStatus(r, new Date()) === 'finished')
    .pop() ?? null

  const [{ data: recentMatches }, { data: activeRoundMatches }] = await Promise.all([
    latestFinishedEarly
      ? supabase
          .from('matches')
          .select('home_team, away_team, home_score, away_score')
          .eq('round_id', latestFinishedEarly.id)
          .not('home_score', 'is', null)
          .order('id', { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] }),

    activeRoundEarly
      ? supabase
          .from('matches')
          .select('id')
          .eq('round_id', activeRoundEarly.id)
      : Promise.resolve({ data: [] }),
  ])

  // Bets har ikke round_id — hent via match_ids
  const activeMatchIds = (activeRoundMatches ?? []).map((m: { id: number }) => m.id)
  const { data: roundBets } =
    activeMatchIds.length > 0
      ? await supabase
          .from('bets')
          .select('id, user_id')
          .eq('game_id', gameId)
          .in('match_id', activeMatchIds)
      : { data: [] as { id: number; user_id: string }[] }

  const typedRoundsForMatchCount = (rounds ?? []) as Round[]
  const { data: matchCountRows } =
    typedRoundsForMatchCount.length > 0
      ? await supabase
          .from('matches')
          .select('round_id')
          .in('round_id', typedRoundsForMatchCount.map((r) => r.id))
      : { data: [] as { round_id: number }[] }
  const matchCountByRound: Record<number, number> = {}
  for (const row of matchCountRows ?? []) {
    matchCountByRound[row.round_id] = (matchCountByRound[row.round_id] ?? 0) + 1
  }

  const typedGame = game as Game
  const members = (rawMembers ?? []) as unknown as MemberRow[]
  const typedRounds = (rounds ?? []) as Round[]

  const scoreMap: RoundScoreMap = {}
  for (const s of (roundScores ?? []) as RoundScore[]) {
    if (!scoreMap[s.user_id]) scoreMap[s.user_id] = {}
    scoreMap[s.user_id][s.round_id] = s.points_earned
  }

  const ranked = assignRanks(
    members.map((m) => ({
      user_id: m.user_id,
      username: m.profile?.username ?? 'Ukendt',
      points: m.points,
    }))
  )

  const now = new Date()
  const roundsWithStatus = typedRounds.map((r) => ({
    ...r,
    computedStatus: computeRoundStatus(r, now),
  }))

  const sortedRounds = [...roundsWithStatus].sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] ?? '0', 10)
    const numB = parseInt(b.name.match(/\d+/)?.[0] ?? '0', 10)
    return numA - numB
  })

  const finishedRounds = sortedRounds.filter((r) => r.computedStatus === 'finished')

  // Aktuel runde: brug current_rounds.round_name hvis tilgængelig, ellers fallback til computeRoundStatus
  const activeRound = currentRound?.round_name
    ? (() => {
        const r = sortedRounds.find((r) => r.name === currentRound.round_name)
        if (!r) return null
        const status = (currentRound.round_status as 'open' | 'active' | 'upcoming' | 'finished') || r.computedStatus
        return { ...r, computedStatus: status }
      })()
    : sortedRounds.find((r) => r.computedStatus === 'open') ??
      sortedRounds.find((r) => r.computedStatus === 'active') ??
      sortedRounds.find((r) => r.computedStatus === 'upcoming') ??
      null

  // Seneste færdige runde
  const latestFinished = [...sortedRounds]
    .filter((r) => r.computedStatus === 'finished')
    .pop() ?? null

  const activeRoundIndex = activeRound ? sortedRounds.findIndex((r) => r.id === activeRound.id) : -1
  const prevRound = activeRoundIndex > 0 ? sortedRounds[activeRoundIndex - 1] : null
  const nextRound = activeRoundIndex >= 0 && activeRoundIndex < sortedRounds.length - 1 ? sortedRounds[activeRoundIndex + 1] : null

  const [{ data: prevRoundKickoff }, { data: nextRoundKickoff }] =
    leagueId != null
      ? await Promise.all([
          prevRound
            ? supabase
                .from('league_matches')
                .select('kickoff_at')
                .eq('league_id', leagueId)
                .eq('round_name', prevRound.name)
                .order('kickoff_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          nextRound
            ? supabase
                .from('league_matches')
                .select('kickoff_at')
                .eq('league_id', leagueId)
                .eq('round_name', nextRound.name)
                .order('kickoff_at', { ascending: true })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])
      : [{ data: null }, { data: null }]

  const prevRoundDate = (prevRoundKickoff as { kickoff_at?: string } | null)?.kickoff_at ?? null
  const nextRoundDate = (nextRoundKickoff as { kickoff_at?: string } | null)?.kickoff_at ?? null

  const myEntry = ranked.find((r) => r.user_id === user.id)

  // ── Byg ticker-beskeder ──────────────────────────────────────────────────────
  const tickerItems: string[] = []

  // Seneste resultater fra afsluttede runde
  for (const m of recentMatches ?? []) {
    if (m.home_score !== null && m.away_score !== null) {
      tickerItems.push(`⚽ ${m.home_team} ${m.home_score}–${m.away_score} ${m.away_team}`)
    }
  }

  // Bet-deadline
  if (activeRound && activeRound.computedStatus === 'open' && activeRound.betting_closes_at) {
    tickerItems.push(
      `🔓 Bets til ${activeRound.name} er åbne — deadline ${formatDate(activeRound.betting_closes_at)}`
    )
  }

  // Bedste better i seneste runde
  if (latestFinished) {
    let topUserId = ''
    let topPts = -Infinity
    for (const entry of ranked) {
      const pts = scoreMap[entry.user_id]?.[latestFinished.id] ?? null
      if (pts !== null && pts > topPts) { topPts = pts; topUserId = entry.user_id }
    }
    const topEntry = ranked.find((r) => r.user_id === topUserId)
    const totalInRound = (recentMatches ?? []).length || null
    if (topEntry && topPts > 0) {
      const suffix = totalInRound ? `/${totalInRound} rigtige` : ' pt'
      tickerItems.push(`🏆 Rundens bedste: ${topEntry.username} — ${topPts}${suffix}`)
    }
  }

  // Spillere der mangler bets til aktiv runde
  const usersWithBets = new Set((roundBets ?? []).map((b) => b.user_id))
  if (activeRound && activeRound.computedStatus === 'open') {
    for (const entry of ranked) {
      if (!usersWithBets.has(entry.user_id)) {
        tickerItems.push(`⚠️ ${entry.username} har ikke afgivet bets endnu`)
      }
    }
  }

  // Streaks — consecutive runder med positiv score
  const sortedFinishedRounds = sortedRounds
    .filter((r) => r.computedStatus === 'finished')
    .slice()
  for (const entry of ranked) {
    let streak = 0
    for (let i = sortedFinishedRounds.length - 1; i >= 0; i--) {
      const pts = scoreMap[entry.user_id]?.[sortedFinishedRounds[i].id] ?? null
      if (pts !== null && pts > 0) { streak++ } else break
    }
    if (streak >= 2) {
      tickerItems.push(`🔥 ${entry.username} er på ${streak} vundne runder i træk`)
    }
  }

  // Altid-tilstedeværende info (vises når dynamisk data endnu mangler)
  tickerItems.push(`🏟 ${typedGame.name} · ${members.length} deltagere · ${typedRounds.length} runder`)
  if (activeRound && activeRound.computedStatus !== 'open') {
    tickerItems.push(`📅 ${activeRound.name} er den aktive runde`)
  }
  if (!activeRound && latestFinished) {
    tickerItems.push(`✅ Alle runder afsluttet i ${typedGame.name}`)
  }

  // ── Per-bruger statistik til leaderboard ───────────────────────────────────
  const placedBetIds = usersWithBets

  const leaderboardRows = ranked.map((entry) => {
    const wins = finishedRounds.filter((r) => (scoreMap[entry.user_id]?.[r.id] ?? null) !== null && (scoreMap[entry.user_id]?.[r.id] ?? 0) > 0).length
    const played = finishedRounds.filter((r) => (scoreMap[entry.user_id]?.[r.id] ?? null) !== null).length
    const losses = played - wins
    const hasActiveBet = placedBetIds.has(entry.user_id)
    return { ...entry, wins, losses, played, hasActiveBet }
  })

  return (
    <LiveMatchesProvider roundId={activeRound?.id ?? null} enabled={!!activeRound}>
    <div className="min-h-screen" style={{ background: '#F2EDE4', fontFamily: "'Barlow', sans-serif" }}>
      <GameTicker items={tickerItems} />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{ background: '#2C4A3E', color: '#F2EDE4', padding: '24px 20px 28px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Top: navn + invite-kode */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1, color: '#F2EDE4' }}>
                {typedGame.name}
              </h1>
              <span style={{ display: 'inline-block', marginTop: 6, background: 'rgba(242,237,228,0.15)', border: '1px solid rgba(242,237,228,0.3)', color: '#F2EDE4', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2 }}>
                {typedGame.status === 'active' ? 'Aktiv' : 'Afsluttet'}
              </span>
            </div>
            <div style={{ background: 'rgba(242,237,228,0.08)', border: '1px solid rgba(242,237,228,0.2)', borderRadius: 2, padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.5)', marginBottom: 4 }}>Invitationskode</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', color: '#F2EDE4' }}>{typedGame.invite_code}</p>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid rgba(242,237,228,0.15)', paddingTop: 16 }}>
            {[
              { label: 'Deltagere', value: String(members.length), gold: false },
              { label: 'Runder',    value: String(typedRounds.length), gold: false },
              { label: 'Placering', value: myEntry ? `#${myEntry.rank}` : '—', gold: false },
              { label: 'Dine point', value: myEntry?.points.toLocaleString('da-DK') ?? '—', gold: true },
            ].map((stat, i) => (
              <div key={stat.label} style={{ paddingLeft: i > 0 ? 12 : 0, paddingRight: i < 3 ? 12 : 0, borderRight: i < 3 ? '1px solid rgba(242,237,228,0.15)' : 'none' }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.5)', marginBottom: 4 }}>{stat.label}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: stat.gold ? '#B8963E' : '#F2EDE4', lineHeight: 1 }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Runder — RoundSlider med borders */}
        <section className="border-t border-b border-[#d4cec4] py-6">
          <p className="text-xs tracking-widest text-[#7a7060] font-['Barlow_Condensed'] uppercase px-5 mb-4">
            Runder
          </p>
          <RoundSlider
            rounds={sortedRounds}
            activeRound={
              activeRound
                ? {
                    id: activeRound.id,
                    name: activeRound.name,
                    round_status: activeRound.computedStatus,
                    betting_closes_at: activeRound.betting_closes_at,
                    first_kickoff: (currentRound as { first_kickoff?: string } | null)?.first_kickoff ?? null,
                    next_kickoff: (currentRound as { next_kickoff?: string } | null)?.next_kickoff ?? null,
                  }
                : null
            }
            betsCount={roundBets?.filter((b) => b.user_id === user.id)?.length ?? 0}
            gameId={gameId}
            matchCountByRound={matchCountByRound}
            prevRoundDate={prevRoundDate}
            nextRoundDate={nextRoundDate}
          />
          {activeRound && (
            <ActiveRoundLiveTicker
              roundId={activeRound.id}
              enabled={activeRound.computedStatus === 'open' || activeRound.computedStatus === 'active'}
            />
          )}
          <div className="px-5 mt-3">
            <Link
              href={`/games/${gameId}/rounds`}
              className="text-xs text-[#7a7060] hover:text-[#3a3530] transition-colors"
            >
              › Se alle runder
            </Link>
          </div>
        </section>

        {sortedRounds.length === 0 && (
          <div style={{ border: '1px dashed #C8BEA8', borderRadius: 2, padding: '48px 16px', textAlign: 'center', color: '#6b6b6b', fontFamily: "'Barlow', sans-serif", fontSize: 14 }}>
            Ingen runder oprettet endnu
          </div>
        )}

        {/* Leaderboard */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b6b6b' }}>Leaderboard</span>
          </div>

          <div style={{ background: '#FDFAF5', border: '1px solid #C8BEA8', borderRadius: 2, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 36px 36px 36px 52px', padding: '8px 12px', background: '#E8E0D3', borderBottom: '1px solid #C8BEA8', gap: 4, alignItems: 'center' }}>
              {['#', 'Spiller', 'R', 'V', 'T', 'PT'].map((h, i) => (
                <span key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6b6b', textAlign: i === 1 ? 'left' : 'center' }} title={i === 2 ? 'Runder spillet' : i === 3 ? 'Vundne runder' : i === 4 ? 'Tabte runder' : undefined}>
                  {h}
                </span>
              ))}
            </div>

            {leaderboardRows.map((entry, idx) => {
              const isMe = entry.user_id === user.id
              const rankColor = entry.rank === 1 ? '#B8963E' : entry.rank === 2 ? '#8A9BA8' : entry.rank === 3 ? '#A0785A' : '#6b6b6b'
              return (
                <div key={entry.user_id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 36px 36px 36px 52px', padding: '10px 12px', borderBottom: idx < leaderboardRows.length - 1 ? '1px solid #E8E0D3' : 'none', gap: 4, alignItems: 'center', background: isMe ? 'rgba(44,74,62,0.05)' : undefined }}>
                  {/* Rank */}
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, textAlign: 'center', color: rankColor }}>{entry.rank}</span>

                  {/* Spiller */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: isMe ? '#3D6B5A' : '#2C4A3E', border: isMe ? '1.5px solid #2C4A3E' : 'none', color: '#F2EDE4', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {entry.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, color: '#1a1a1a' }}>
                        {entry.username}{isMe && <span style={{ fontSize: 11, color: '#6b6b6b', fontWeight: 300 }}> · dig</span>}
                      </div>
                      {activeRound && (
                        <div style={{ fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: entry.hasActiveBet ? '#4CAF50' : '#D4A017', flexShrink: 0 }} />
                          <span style={{ color: entry.hasActiveBet ? '#4CAF50' : '#B8860B' }}>
                            {entry.hasActiveBet ? 'Bets afgivet' : 'Mangler bets'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* R */}
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 400, textAlign: 'center', color: '#6b6b6b' }}>{entry.played}</span>
                  {/* V */}
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600, textAlign: 'center', color: '#2C4A3E' }}>{entry.wins}</span>
                  {/* T */}
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600, textAlign: 'center', color: '#8B2E2E' }}>{entry.losses}</span>
                  {/* PT */}
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, textAlign: 'right', color: entry.rank === 1 ? '#B8963E' : '#1a1a1a' }}>{entry.points.toLocaleString('da-DK')}</span>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 2px 0', alignItems: 'center' }}>
            {[
              { dot: '#4CAF50', label: 'Bets afgivet' },
              { dot: '#7a7060', label: 'Mangler bets' },
            ].map(({ dot, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b6b6b', fontWeight: 300 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
                {label}
              </div>
            ))}
            <span style={{ fontSize: 11, color: '#6b6b6b', fontWeight: 300 }}>R = runder · V = vundet · T = tabt · PT = point</span>
          </div>
        </div>
      </div>
    </div>
    </LiveMatchesProvider>
  )
}

