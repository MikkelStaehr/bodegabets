'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Match, Bet } from '@/types'
import { BET_TYPE_LABELS } from '@/lib/betTypes'
import { isBetCorrect } from '@/lib/betUtils'
import { useToast } from '@/components/ui/Toast'
import GameTicker from '@/components/GameTicker'
import LiveMatches from '@/components/LiveMatches'

type MatchWithOptions = Match

type ExtraBetType = 'btts' | 'over_under' | 'halvleg' | 'malforskel'

type ExtraBet = {
  type: ExtraBetType
  prediction: string
  points: number
}

type BetEntry = {
  matchId: number
  outcome: '1' | 'X' | '2'
  points: number
  match: MatchWithOptions
  extraBets: ExtraBet[]
}

const EXTRA_BET_ROWS = [
  {
    key: 'over_under' as const,
    label: 'Over/under',
    opts: [
      { label: 'Over 2.5', value: 'over' },
      { label: 'Under 2.5', value: 'under' },
    ],
  },
  {
    key: 'halvleg' as const,
    label: 'Halvleg',
    opts: [
      { label: '1. HV', value: 'h1' },
      { label: '2. HV', value: 'h2' },
      { label: 'Lige', value: 'draw' },
    ],
  },
  {
    key: 'malforskel' as const,
    label: 'Målforskel',
    opts: [
      { label: '2+', value: '2plus' },
      { label: '1 mål', value: '1goal' },
      { label: 'Uafgjort', value: 'udraw' },
    ],
  },
  {
    key: 'btts' as const,
    label: 'Begge scorer',
    opts: [
      { label: 'Ja', value: 'yes' },
      { label: 'Nej', value: 'no' },
    ],
  },
] as const

const EXTRA_BET_TYPES: ExtraBetType[] = ['btts', 'over_under', 'halvleg', 'malforskel']

type RivalryInfo = { rivalry_name: string; multiplier: number }

type Props = {
  gameId: number
  roundId: number
  gameName: string
  round: {
    name: string
    betting_closes_at: string | null
    status: string
  }
  matches: MatchWithOptions[]
  existingBets: Bet[]
  userPoints: number
  usedPoints?: number
  tickerItems: string[]
  rivalryInfo?: Record<number, RivalryInfo>
  totalMatchesInRound?: number
}

function initSelections(matches: MatchWithOptions[], existing: Bet[]): BetEntry[] {
  const entries: BetEntry[] = []
  for (const m of matches) {
    if (m.status === 'finished' || m.status === 'live' || m.status === 'halftime' || m.bet_open !== true) continue
    const mr = existing.find((b) => b.match_id === m.id && b.bet_type === 'match_result')
    if (mr) {
      const extraBets: ExtraBet[] = existing
        .filter(
          (b) =>
            b.match_id === m.id &&
            (EXTRA_BET_TYPES.includes(b.bet_type as ExtraBetType) || b.bet_type === 'halftime')
        )
        .map((b) => ({
          type: (b.bet_type === 'halftime' ? 'halvleg' : b.bet_type) as ExtraBetType,
          prediction: b.prediction,
          points: b.stake,
        }))
      entries.push({
        matchId: m.id,
        outcome: mr.prediction as '1' | 'X' | '2',
        points: mr.stake,
        match: m,
        extraBets,
      })
    }
  }
  return entries
}

function formatKickoff(iso: string) {
  const d = new Date(iso)
  const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
  if (isMidnight) {
    return d.toLocaleDateString('da-DK', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
  }
  return d.toLocaleString('da-DK', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDeadline(iso: string | null) {
  if (!iso) return { time: '—', date: '' }
  const d = new Date(iso)
  return {
    time: d.toLocaleTimeString('da-DK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('da-DK', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

function firstWord(s: string) {
  return s.split(' ')[0] || s
}

function getCorrectOutcome(match: Match): '1' | 'X' | '2' | null {
  if (match.status !== 'finished' || match.home_score == null || match.away_score == null) return null
  if (match.home_score > match.away_score) return '1'
  if (match.home_score < match.away_score) return '2'
  return 'X'
}

export default function AfgivBets({
  gameId,
  roundId,
  gameName,
  round,
  matches,
  existingBets,
  userPoints,
  usedPoints = 0,
  tickerItems,
  rivalryInfo = {},
  totalMatchesInRound,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [selections, setSelections] = useState<BetEntry[]>(() => initSelections(matches, existingBets))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isReadOnly = round.status === 'finished'

  const matchBettingOpen = useCallback(
    (match: MatchWithOptions): boolean => {
      if (round.status === 'finished') return false
      if (match.status === 'finished') return false
      return match.bet_open === true
    },
    [round.status]
  )

  const totalMatches = matches.length
  const totalPoints = selections.reduce((sum, s) => {
    const main = s.points
    const extra = s.extraBets.reduce((es, eb) => es + eb.points, 0)
    return sum + main + extra
  }, 0)
  const availablePoints = userPoints - usedPoints
  const displayCredits = availablePoints - totalPoints

  const getSelection = (matchId: number) => selections.find((s) => s.matchId === matchId)

  const selectOutcome = (matchId: number, outcome: '1' | 'X' | '2') => {
    if (isReadOnly) return
    const match = matches.find((m) => m.id === matchId)
    if (!match || !matchBettingOpen(match)) return

    const existing = getSelection(matchId)
    if (existing) {
      if (existing.outcome === outcome) {
        // Deselect
        setSelections((prev) => prev.filter((s) => s.matchId !== matchId))
        return
      }
      setSelections((prev) =>
        prev.map((s) => (s.matchId === matchId ? { ...s, outcome } : s))
      )
    } else {
      setSelections((prev) => [
        ...prev,
        { matchId, outcome, points: 100, match, extraBets: [] },
      ])
    }
  }

  const adjustStake = (matchId: number, delta: number) => {
    setSelections((prev) =>
      prev.map((s) =>
        s.matchId === matchId ? { ...s, points: Math.max(10, s.points + delta) } : s
      )
    )
  }

  const setStake = (matchId: number, val: number) => {
    setSelections((prev) =>
      prev.map((s) => (s.matchId === matchId ? { ...s, points: Math.max(10, val) } : s))
    )
  }

  const toggleExtra = (matchId: number, key: ExtraBetType, value: string) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.matchId !== matchId) return s
        const existing = s.extraBets.find((eb) => eb.type === key)
        let next: ExtraBet[]
        if (existing?.prediction === value) {
          // Deselect
          next = s.extraBets.filter((eb) => eb.type !== key)
        } else if (existing) {
          // Switch value
          next = s.extraBets.map((eb) => (eb.type === key ? { ...eb, prediction: value } : eb))
        } else {
          // Add new
          next = [...s.extraBets, { type: key, prediction: value, points: s.points }]
        }
        return { ...s, extraBets: next }
      })
    )
  }

  async function handleSubmit() {
    if (selections.length === 0) return
    if (totalPoints > availablePoints) {
      toast(`Ikke nok credits. Du har ${availablePoints} pt.`, 'error')
      return
    }

    const payload = {
      game_id: gameId,
      bets: [
        ...selections.map((s) => ({
          match_id: s.matchId,
          bet_type: 'match_result' as const,
          prediction: s.outcome,
          stake: s.points,
        })),
        ...selections.flatMap((s) =>
          s.extraBets.map((eb) => ({
            match_id: s.matchId,
            bet_type: eb.type,
            prediction: eb.prediction,
            stake: eb.points,
          }))
        ),
      ],
    }

    setIsSubmitting(true)
    const res = await fetch(`/api/rounds/${roundId}/submit-bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setIsSubmitting(false)

    if (!res.ok) {
      toast(data.error ?? 'Noget gik galt', 'error')
      return
    }

    toast('Valg gemt ✓', 'success')
    router.push(`/games/${gameId}`)
  }

  const deadline = formatDeadline(round.betting_closes_at)
  const isOverBudget = displayCredits < 0

  // Sort matches by kickoff
  const sorted = useMemo(
    () => [...matches].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at)),
    [matches]
  )

  return (
    <div className="min-h-screen bg-[#F2EDE4] pb-[80px]">
      {/* Nav */}
      <nav className="bg-[#1a3329] h-[52px] flex items-center px-4 gap-3 sticky top-0 z-[100]">
        <Link href={`/games/${gameId}`} className="text-[rgba(242,237,228,0.5)] text-xl">
          ‹
        </Link>
        <span className="font-condensed text-lg font-bold text-[#F2EDE4] tracking-wide">
          Bodega Bets
        </span>
      </nav>

      {/* Ticker */}
      {tickerItems.length > 0 && <GameTicker items={tickerItems} />}

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="w-full bg-[#c0392b]/15 border-b border-[#c0392b]/30 px-4 py-3 text-[#c0392b] text-sm text-center">
          Denne runde er lukket for valg
        </div>
      )}

      {/* Header */}
      <div className="w-full bg-white border-b border-black/10">
        <div className="max-w-[680px] mx-auto px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold tracking-widest text-[#7a7060] uppercase mb-1">
              {gameName} · {round.name}
            </p>
            <h1 className="font-condensed text-[28px] font-extrabold text-[#1a3329] leading-none">
              Afgiv dine valg
            </h1>
          </div>
          <div className="bg-[#F2EDE4] border border-black/10 rounded-lg px-3 py-2 text-right shrink-0">
            <div className="text-[8px] font-bold tracking-widest text-[#7a7060] uppercase">
              Deadline
            </div>
            <span className="font-condensed text-[20px] font-bold text-[#c0392b] block leading-tight">
              {deadline.time}
            </span>
            <div className="text-[10px] text-[#7a7060]">{deadline.date}</div>
          </div>
        </div>
      </div>

      {/* Main content — single column, max 680px */}
      <div className="max-w-[680px] mx-auto px-4 py-4">
        <LiveMatches
          roundId={roundId}
          gameId={gameId}
          gameName={gameName}
          roundName={round.name}
        />

        {/* Match cards */}
        {(() => {
          const elements: React.ReactNode[] = []
          let lastDateKey = ''
          for (const match of sorted) {
            const dateKey = match.kickoff_at
              ? new Date(match.kickoff_at).toLocaleDateString('da-DK', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  timeZone: 'UTC',
                })
              : ''
            if (dateKey && dateKey !== lastDateKey) {
              const label = new Date(match.kickoff_at).toLocaleDateString('da-DK', {
                weekday: 'long', day: 'numeric', month: 'long',
                timeZone: 'UTC',
              })
              elements.push(
                <div key={`sep-${dateKey}`} className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-[#e5e0d8]" />
                  <span className="text-[11px] font-semibold text-[#9E9486] uppercase tracking-wide whitespace-nowrap">
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-[#e5e0d8]" />
                </div>
              )
              lastDateKey = dateKey
            }

            const isFinished = match.status === 'finished'
            const isLocked = !match.bet_open
            const isOpen = matchBettingOpen(match)
            const sel = getSelection(match.id)
            const rivalry = rivalryInfo[match.id]
            const isRivalry = !!rivalry
            const correctOutcome = getCorrectOutcome(match)

            // Get user's existing bets for this match (for read-only display)
            const matchResultBet = existingBets.find(
              (b) => b.match_id === match.id && b.bet_type === 'match_result'
            )
            const userExtraPicks: Record<string, string> = {}
            for (const b of existingBets) {
              if (b.match_id === match.id && EXTRA_BET_TYPES.includes(b.bet_type as ExtraBetType)) {
                userExtraPicks[b.bet_type] = b.prediction
              }
            }

            // Determine which outcome to highlight
            const selectedOutcome = sel?.outcome ?? null
            const userPrediction = (matchResultBet?.prediction as '1' | 'X' | '2') ?? null
            const displayOutcome = isFinished ? userPrediction : selectedOutcome

            // Card styling
            const cardBg = isRivalry ? 'bg-[#1a3329]' : 'bg-white'
            const cardBorder = isRivalry
              ? 'border-[#B8963E]'
              : sel
                ? 'border-[#2C4A3E] shadow-[0_0_0_1px_#2C4A3E]'
                : 'border-black/10'
            const textPrimary = isRivalry ? 'text-[#F2EDE4]' : 'text-[#1a3329]'
            const textSecondary = isRivalry ? 'text-[#F2EDE4]/50' : 'text-[#7a7060]'
            const scoreSep = isRivalry ? 'text-[#F2EDE4]/60' : 'text-[#7a7060]'

            elements.push(
              <div
                key={match.id}
                className={`${cardBg} border rounded-lg mb-2 overflow-hidden transition-all ${cardBorder}`}
              >
                {/* Rivalry badge */}
                {isRivalry && (
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-0.5">
                    <span className="text-[12px]">🔥</span>
                    <span className="font-['Barlow_Condensed'] text-[11px] font-bold text-[#B8963E] uppercase tracking-widest">
                      {rivalry.rivalry_name} · {rivalry.multiplier}×
                    </span>
                  </div>
                )}

                {/* Teams + kickoff */}
                <div className="px-3 pt-2">
                  <div className="flex items-center justify-between gap-2 h-10">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span className={`font-condensed font-bold text-[15px] ${textPrimary} truncate`} style={{ maxWidth: 120 }}>
                        {match.home_team}
                      </span>
                      {match.home_team_logo && (
                        <img src={match.home_team_logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} className="shrink-0" />
                      )}
                    </div>
                    {isFinished && match.home_score != null && match.away_score != null ? (
                      <span className={`font-condensed font-bold text-[13px] ${scoreSep} shrink-0`}>
                        {match.home_score} – {match.away_score}
                      </span>
                    ) : (
                      <span className={`text-[9px] ${textSecondary} font-semibold shrink-0`}>vs</span>
                    )}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {match.away_team_logo && (
                        <img src={match.away_team_logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} className="shrink-0" />
                      )}
                      <span className={`font-condensed font-bold text-[15px] ${textPrimary} truncate`} style={{ maxWidth: 120 }}>
                        {match.away_team}
                      </span>
                    </div>
                  </div>
                  <div className="text-center pb-1">
                    <span className={`text-[10px] ${textSecondary}`}>
                      {isFinished ? 'Færdig' : isLocked ? '🔒 Lukket' : formatKickoff(match.kickoff_at)}
                    </span>
                  </div>
                </div>

                {/* 1-X-2 buttons */}
                <div className="flex gap-1 px-3 pb-2">
                  {(['1', 'X', '2'] as const).map((o) => {
                    const active = displayOutcome === o
                    const isUserPick = isFinished && userPrediction === o
                    const isCorrect = isFinished && correctOutcome === o
                    const isUserCorrect = isUserPick && isCorrect

                    let btnClass: string
                    if (isFinished && (isUserPick || isCorrect)) {
                      if (isUserCorrect) {
                        btnClass = 'bg-[#27ae60] border-[#B8963E] border-[2.5px] shadow-[0_0_0_1px_#B8963E]'
                      } else if (isUserPick) {
                        btnClass = 'bg-[#27ae60] border-[#27ae60]'
                      } else if (isRivalry) {
                        btnClass = 'bg-[#2C4A3E] border-[#B8963E] border-[2.5px]'
                      } else {
                        btnClass = 'bg-[#F2EDE4] border-[#B8963E] border-[2.5px]'
                      }
                    } else if (active) {
                      btnClass = isRivalry
                        ? 'bg-[#B8963E] border-[#B8963E]'
                        : 'bg-[#1a3329] border-[#1a3329]'
                    } else {
                      btnClass = isRivalry
                        ? 'bg-[#2C4A3E] border-[#B8963E]/30 hover:border-[#B8963E]'
                        : 'bg-[#F2EDE4] border-black/10 hover:border-[#2C4A3E]'
                    }

                    const textLight = active || isUserPick
                    const sub =
                      o === '1' ? firstWord(match.home_team) : o === '2' ? firstWord(match.away_team) : 'Uafgjort'

                    const disabled = isReadOnly || !isOpen

                    return (
                      <button
                        key={o}
                        type="button"
                        disabled={disabled}
                        onClick={() => selectOutcome(match.id, o)}
                        className={`flex-1 py-1.5 border-[1.5px] rounded-md flex flex-col items-center gap-0.5 transition-all ${btnClass} ${disabled ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`font-condensed text-[17px] font-bold leading-none ${
                            textLight
                              ? isRivalry ? 'text-[#1a3329]' : 'text-white'
                              : isRivalry ? 'text-[#F2EDE4]/70' : 'text-[#7a7060]'
                          }`}
                        >
                          {o}
                        </span>
                        <span
                          className={`text-[8px] font-medium ${
                            textLight
                              ? isRivalry ? 'text-[#1a3329]/60' : 'text-white/60'
                              : isRivalry ? 'text-[#F2EDE4]/40' : 'text-[#7a7060]'
                          }`}
                        >
                          {sub}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Extra bets — inline rows, only for open matches with a selection */}
                {isOpen && sel && (
                  <div className="px-3 pb-2 flex flex-col gap-1.5">
                    {EXTRA_BET_ROWS.map((row) => {
                      const pick = sel.extraBets.find((eb) => eb.type === row.key)?.prediction
                      return (
                        <div key={row.key}>
                          <span className={`text-[9px] font-bold tracking-wider uppercase mb-1 block ${isRivalry ? 'text-[#B8963E]/70' : 'text-[#7a7060]'}`}>
                            {row.label}
                          </span>
                          <div className="flex gap-1">
                            {row.opts.map((opt) => {
                              const active = pick === opt.value
                              let cls: string
                              if (active) {
                                cls = isRivalry
                                  ? 'bg-[#B8963E] border-[#B8963E] text-[#1a3329]'
                                  : 'bg-[#2C4A3E] border-[#2C4A3E] text-white'
                              } else {
                                cls = isRivalry
                                  ? 'bg-[#2C4A3E] border-[#B8963E]/20 text-[#F2EDE4]/60 hover:border-[#B8963E]/50'
                                  : 'bg-white border-black/10 text-[#7a7060] hover:border-[#2C4A3E] hover:text-[#1a3329]'
                              }
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => toggleExtra(match.id, row.key, opt.value)}
                                  className={`flex-1 py-1 border-[1.5px] rounded text-[10px] font-semibold transition-all ${cls}`}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Finished match: show user extra picks read-only */}
                {isFinished && Object.keys(userExtraPicks).length > 0 && (
                  <div className="px-3 pb-2 flex flex-col gap-1">
                    {EXTRA_BET_ROWS
                      .filter((row) => userExtraPicks[row.key])
                      .map((row) => {
                        const userValue = userExtraPicks[row.key]
                        const canCheck = match.home_score != null && match.away_score != null
                        return (
                          <div key={row.key}>
                            <span className="text-[9px] font-bold tracking-wider uppercase mb-1 block text-[#7a7060]">
                              {row.label}
                            </span>
                            <div className="flex gap-1">
                              {row.opts.map((opt) => {
                                const isUserPick = userValue === opt.value
                                const isCorrect = canCheck && isBetCorrect(
                                  row.key, opt.value,
                                  match.home_score!, match.away_score!,
                                  match.home_score_ht, match.away_score_ht
                                )
                                const isUserCorrect = isUserPick && isCorrect

                                let cls: string
                                if (isUserCorrect) {
                                  cls = 'bg-[#27ae60] border-[#B8963E] border-[2.5px] shadow-[0_0_0_1px_#B8963E] text-white'
                                } else if (isUserPick) {
                                  cls = 'bg-[#27ae60] border-[#27ae60] text-white'
                                } else if (isCorrect) {
                                  cls = 'bg-[#F2EDE4] border-[#B8963E] border-[2.5px] text-[#7a7060]'
                                } else {
                                  cls = 'bg-white border-black/10 text-[#7a7060]'
                                }

                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    disabled
                                    className={`flex-1 py-1 border-[1.5px] rounded text-[10px] font-semibold cursor-not-allowed opacity-80 ${cls}`}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                {/* Stake input — only for open matches with a selection */}
                {isOpen && sel && (
                  <div className={`flex items-center gap-2 px-3 py-2 ${isRivalry ? 'border-t border-[#B8963E]/20' : 'border-t border-black/[0.06]'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isRivalry ? 'text-[#B8963E]/70' : 'text-[#7a7060]'}`}>
                      Stake
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => adjustStake(match.id, -50)}
                        className={`w-7 h-7 border rounded font-bold text-sm flex items-center justify-center ${
                          isRivalry
                            ? 'border-[#B8963E]/30 bg-[#2C4A3E] text-[#F2EDE4]'
                            : 'border-black/10 bg-[#F2EDE4] text-[#1a3329]'
                        }`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={10}
                        value={sel.points}
                        onChange={(e) => setStake(match.id, parseInt(e.target.value) || 10)}
                        className={`w-16 text-center font-condensed text-[15px] font-bold border rounded h-7 ${
                          isRivalry
                            ? 'border-[#B8963E]/30 bg-[#2C4A3E] text-[#F2EDE4]'
                            : 'border-black/10 bg-[#F2EDE4] text-[#1a3329]'
                        }`}
                      />
                      <span className={`text-[10px] font-semibold ${isRivalry ? 'text-[#F2EDE4]/50' : 'text-[#7a7060]'}`}>
                        pt
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustStake(match.id, 50)}
                        className={`w-7 h-7 border rounded font-bold text-sm flex items-center justify-center ${
                          isRivalry
                            ? 'border-[#B8963E]/30 bg-[#2C4A3E] text-[#F2EDE4]'
                            : 'border-black/10 bg-[#F2EDE4] text-[#1a3329]'
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Locked match: show stake read-only */}
                {!isOpen && matchResultBet && (
                  <div className="flex items-center justify-between px-3 py-1.5 border-t border-black/[0.06]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a7060]">
                      Stake
                    </span>
                    <span className="font-condensed text-[14px] font-bold text-[#7a7060]">
                      {matchResultBet.stake} pt
                    </span>
                  </div>
                )}
              </div>
            )
          }
          return elements
        })()}
      </div>

      {/* Sticky footer */}
      {!isReadOnly && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-[90] border-t-2 transition-colors ${
            isOverBudget ? 'bg-[#c0392b] border-[#c0392b]' : 'bg-[#1a3329] border-[#1a3329]'
          }`}
        >
          <div className="max-w-[680px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">
                Dine credits
              </span>
              <span className={`font-condensed text-[20px] font-extrabold leading-none ${
                isOverBudget ? 'text-white' : 'text-[#B8963E]'
              }`}>
                {displayCredits} pt
              </span>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selections.length === 0 || isSubmitting || isOverBudget}
              className={`h-[42px] px-5 rounded-lg font-condensed text-[14px] font-bold tracking-wider transition-all ${
                isOverBudget || selections.length === 0 || isSubmitting
                  ? 'bg-white/20 text-white/40 cursor-not-allowed'
                  : 'bg-[#B8963E] text-[#1a3329] hover:bg-[#d4aa55] hover:-translate-y-px'
              }`}
            >
              {isSubmitting
                ? 'Gemmer...'
                : `${selections.length} valg · ${totalPoints} pt · LÅS VALG →`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
