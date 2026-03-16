'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Match, Bet } from '@/types'
import { BET_TYPE_LABELS } from '@/lib/betTypes'
import { scoresToPrediction } from '@/lib/betScores'
import { isBetCorrect } from '@/lib/betUtils'
import { useToast } from '@/components/ui/Toast'
import GameTicker from '@/components/GameTicker'
import LiveMatches from '@/components/LiveMatches'

type MatchWithOptions = Match

type ExtraBetType = 'btts' | 'over_under' | 'halvleg' | 'malforskel'

type ExtraBet = {
  type: ExtraBetType
  prediction: string // Lagret værdi (yes/no, over/under, h1/h2/draw, 2plus/1goal/udraw)
  points: number
}

type BetEntry = {
  matchId: number
  outcome: '1' | 'X' | '2'
  points: number
  isManual?: boolean
  match: MatchWithOptions
  extraBets: ExtraBet[]
}

const EXTRA_BET_ROWS = [
  {
    key: 'btts' as const,
    label: 'Begge hold scorer',
    opts: [
      { label: 'Ja', value: 'yes' },
      { label: 'Nej', value: 'no' },
    ],
  },
  {
    key: 'over_under' as const,
    label: 'Over/under 2.5 mål',
    opts: [
      { label: 'Over', value: 'over' },
      { label: 'Under', value: 'under' },
    ],
  },
  {
    key: 'halvleg' as const,
    label: 'Flest mål halvleg',
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
] as const

function getExtraBetLabel(type: ExtraBetType, value: string): string {
  const row = EXTRA_BET_ROWS.find((r) => r.key === type)
  const opt = row?.opts.find((o) => o.value === value)
  return opt?.label ?? value
}

const EXTRA_LABELS: Record<ExtraBetType, string> = {
  btts: BET_TYPE_LABELS.btts ?? 'Begge scorer',
  over_under: BET_TYPE_LABELS.over_under ?? 'Over/under',
  halvleg: BET_TYPE_LABELS.halvleg ?? 'Halvleg',
  malforskel: BET_TYPE_LABELS.malforskel ?? 'Målforskel',
}

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
  bettingBalance: number
  tickerItems: string[]
  rivalryInfo?: Record<number, RivalryInfo>
  totalMatchesInRound?: number
}

const OUTCOME_LABELS: Record<'1' | 'X' | '2', string> = {
  '1': 'Hjemmehold sejr',
  X: 'Uafgjort',
  '2': 'Udehold sejr',
}

const EXTRA_BET_TYPES: ExtraBetType[] = ['btts', 'over_under', 'halvleg', 'malforskel']

function initSelections(matches: MatchWithOptions[], existing: Bet[]): BetEntry[] {
  const entries: BetEntry[] = []
  for (const m of matches) {
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
    return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  return d.toLocaleString('da-DK', {
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
    time: d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

function firstWord(s: string) {
  return s.split(' ')[0] || s
}

/** Compute the correct 1/X/2 result for a finished match */
function getCorrectOutcome(match: Match): '1' | 'X' | '2' | null {
  if (match.status !== 'finished' || match.home_score == null || match.away_score == null) return null
  return scoresToPrediction(match.home_score, match.away_score)
}

function ExtraBets({
  match,
  matchId,
  isReadOnly,
  extraBets,
  onExtraChange,
  fastPoints,
  userExtraPicks,
}: {
  match: Match
  matchId: number
  isReadOnly: boolean
  extraBets: ExtraBet[]
  onExtraChange: (matchId: number, extras: ExtraBet[]) => void
  fastPoints: number
  userExtraPicks: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const isFinished = match.status === 'finished'

  // picks[key] = lagret value (yes, no, over, under, h1, h2, draw, 2plus, 1goal, udraw)
  const picks: Record<string, string> = Object.fromEntries(
    extraBets.map((eb) => [eb.type, eb.prediction])
  )

  const toggle = (key: ExtraBetType, value: string) => {
    const next = { ...picks }
    next[key] = picks[key] === value ? '' : value
    const pts = fastPoints || 100
    const extras: ExtraBet[] = Object.entries(next)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => ({ type: k as ExtraBetType, prediction: v, points: pts }))
    onExtraChange(matchId, extras)
  }

  // For finished matches with user picks, show results expanded
  if (isReadOnly && !isFinished) return null
  if (isReadOnly && isFinished && Object.keys(userExtraPicks).length === 0) return null

  // Finished matches with user picks: always show expanded
  const showExpanded = isFinished ? true : open

  return (
    <>
      {!isFinished && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 border-t border-dashed border-black/10 text-left"
        >
          <span className="text-[9px] font-bold tracking-widest text-[#7a7060] uppercase flex-1">
            + Ekstra valg
          </span>
          <span
            className={`text-[9px] text-[#7a7060] transition-transform ${open ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>
      )}

      {showExpanded && (
        <div className="px-2.5 pb-3 pt-2 border-t border-black/10 bg-[#F2EDE4]/50 flex flex-col gap-1.5">
          {EXTRA_BET_ROWS
            .filter((row) => !isFinished || userExtraPicks[row.key])
            .map((row) => {
            const userValue = userExtraPicks[row.key] ?? null
            const canCheck = isFinished && match.home_score != null && match.away_score != null

            return (
              <div key={row.key} className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#7a7060] w-[115px] shrink-0">{row.label}</span>
                <div className="flex gap-1 flex-1">
                  {row.opts.map((opt) => {
                    const isUserPick = isFinished && userValue === opt.value
                    const isCorrect = canCheck && isBetCorrect(
                      row.key, opt.value,
                      match.home_score!, match.away_score!,
                      match.home_score_ht, match.away_score_ht
                    )
                    const isUserCorrect = isUserPick && isCorrect

                    let btnClass: string
                    if (isFinished && (isUserPick || isCorrect)) {
                      if (isUserCorrect) {
                        btnClass = 'bg-[#27ae60] border-[#B8963E] border-[2.5px] shadow-[0_0_0_1px_#B8963E] text-white'
                      } else if (isUserPick) {
                        btnClass = 'bg-[#E8E0D4] border-[#c0392b]/40 border-[2px] text-[#7a7060]'
                      } else {
                        btnClass = 'bg-[#F2EDE4] border-[#B8963E] border-[2.5px] text-[#7a7060]'
                      }
                    } else if (picks[row.key] === opt.value) {
                      btnClass = 'bg-[#2C4A3E] border-[#2C4A3E] text-white'
                    } else {
                      btnClass = 'bg-white border-black/10 text-[#7a7060] hover:border-[#2C4A3E] hover:text-[#1a3329]'
                    }

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isFinished}
                        onClick={() => toggle(row.key, opt.value)}
                        className={`flex-1 py-1 border-[1.5px] rounded text-[10px] font-semibold transition-all ${btnClass} ${isFinished ? 'cursor-not-allowed' : ''}`}
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
    </>
  )
}

function RivalryPointEstimate({
  userPoints,
  totalMatches,
  multiplier,
}: {
  userPoints: number
  totalMatches: number
  multiplier: number
}) {
  const baseEstimate = totalMatches > 0 ? Math.round(userPoints / totalMatches) : 100
  const boosted = Math.round(baseEstimate * multiplier)
  return (
    <p className="px-3 pb-2 text-[11px] font-['Barlow_Condensed'] font-light text-[#c4b89a]">
      Korrekt tip giver ~{baseEstimate} pt · med {multiplier}× rivalry bonus → ~{boosted} pt
    </p>
  )
}

function MatchCard({
  match,
  selectedOutcome,
  onSelect,
  disabled,
  isLocked,
  extraBetsEnabled,
  isReadOnly,
  extraBets,
  onExtraChange,
  fastPoints,
  userPrediction,
  userStake,
  userExtraPicks,
  rivalry,
  userPoints,
  totalMatches,
}: {
  match: MatchWithOptions
  selectedOutcome: '1' | 'X' | '2' | null
  onSelect: (outcome: '1' | 'X' | '2') => void
  disabled: boolean
  isLocked?: boolean
  extraBetsEnabled: boolean
  isReadOnly: boolean
  extraBets: ExtraBet[]
  onExtraChange: (matchId: number, extras: ExtraBet[]) => void
  fastPoints: number
  userPrediction: '1' | 'X' | '2' | null
  userStake: number | null
  userExtraPicks: Record<string, string>
  rivalry?: RivalryInfo
  userPoints: number
  totalMatches: number
}) {
  const isFinished = match.status === 'finished'
  const correctOutcome = getCorrectOutcome(match)
  const isRivalry = !!rivalry

  if (isRivalry) {
    return (
      <div
        className={`rivalry-card relative rounded-lg mb-1.5 overflow-hidden transition-all ${isLocked ? 'opacity-75' : ''}`}
        style={{
          background: '#1a3329',
          border: '1.5px solid #B8963E',
          boxShadow: selectedOutcome ? '0 0 0 1px #B8963E' : undefined,
        }}
      >
        {/* Fire pseudo-elements via CSS class */}
        <div className="rivalry-fire" />

        {/* Rivalry badge */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
          <span className="text-[12px]">🔥</span>
          <span className="font-['Barlow_Condensed'] text-[11px] font-bold text-[#B8963E] uppercase tracking-widest">
            {rivalry.rivalry_name} · {rivalry.multiplier}×
          </span>
        </div>

        {/* Holdnavn + tid/resultat */}
        <div className="flex items-center gap-2 px-2.5 h-10">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-condensed font-bold text-[15px] text-[#F2EDE4] truncate max-w-[100px]">
              {match.home_team}
            </span>
            {isFinished && match.home_score != null && match.away_score != null ? (
              <span className="font-condensed font-bold text-[13px] text-[#F2EDE4]/60 shrink-0">
                {match.home_score} – {match.away_score}
              </span>
            ) : (
              <span className="text-[9px] text-[#F2EDE4]/50 font-semibold shrink-0">vs</span>
            )}
            <span className="font-condensed font-bold text-[15px] text-[#F2EDE4] truncate max-w-[100px]">
              {match.away_team}
            </span>
          </div>
          <span className="text-[10px] text-[#F2EDE4]/50 shrink-0 flex items-center gap-1">
            {isLocked && <span title="Låst – kickoff inden for 30 min">🔒</span>}
            {userStake != null && (
              <span className="font-condensed font-bold text-[#B8963E] text-[10px]">{userStake} pt</span>
            )}
            {isFinished ? 'Færdig' : formatKickoff((match as { kickoff_at?: string; kickoff?: string }).kickoff_at ?? (match as { kickoff_at?: string; kickoff?: string }).kickoff ?? '')}
          </span>
        </div>

        {/* 1-X-2 med guld border */}
        <div className="flex gap-1 px-2.5 pb-2">
          {(['1', 'X', '2'] as const).map((o) => {
            const active = selectedOutcome === o
            const isUserPick = isFinished && userPrediction === o
            const isCorrect = isFinished && correctOutcome === o
            const isUserCorrect = isUserPick && isCorrect

            let btnClass: string
            if (isFinished && (isUserPick || isCorrect)) {
              if (isUserCorrect) {
                btnClass = 'bg-[#27ae60] border-[#B8963E] border-[2.5px] shadow-[0_0_0_1px_#B8963E]'
              } else if (isUserPick) {
                btnClass = 'bg-[#3d2e1f] border-[#c0392b]/50 border-[2px]'
              } else {
                btnClass = 'bg-[#2C4A3E] border-[#B8963E] border-[2.5px]'
              }
            } else if (active) {
              btnClass = 'bg-[#B8963E] border-[#B8963E]'
            } else {
              btnClass = 'bg-[#2C4A3E] border-[#B8963E]/30 hover:border-[#B8963E]'
            }

            const textLight = active || isUserPick
            const sub =
              o === '1' ? firstWord(match.home_team) : o === '2' ? firstWord(match.away_team) : 'Uafgjort'
            return (
              <button
                key={o}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(o)}
                className={`flex-1 py-1.5 border-[1.5px] rounded-md flex flex-col items-center gap-0.5 transition-all ${btnClass} ${disabled ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`font-condensed text-[17px] font-bold leading-none ${textLight ? 'text-[#1a3329]' : 'text-[#F2EDE4]/70'}`}>
                  {o}
                </span>
                <span className={`text-[8px] font-medium ${textLight ? 'text-[#1a3329]/60' : 'text-[#F2EDE4]/40'}`}>
                  {sub}
                </span>
              </button>
            )
          })}
        </div>

        {/* Point calculator */}
        <RivalryPointEstimate
          userPoints={userPoints}
          totalMatches={totalMatches}
          multiplier={rivalry.multiplier}
        />

        {extraBetsEnabled && (
          <ExtraBets
            match={match}
            matchId={match.id}
            isReadOnly={isReadOnly}
            extraBets={extraBets}
            onExtraChange={onExtraChange}
            fastPoints={fastPoints}
            userExtraPicks={userExtraPicks}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className={`bg-white border rounded-lg mb-1.5 overflow-hidden transition-all ${
        selectedOutcome ? 'border-[#2C4A3E] shadow-[0_0_0_1px_#2C4A3E]' : 'border-black/10'
      } ${isLocked ? 'opacity-75' : ''}`}
    >
      {/* Holdnavn + tid/resultat — én linje */}
      <div className="flex items-center gap-2 px-2.5 h-10">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="font-condensed font-bold text-[15px] text-[#1a3329] truncate max-w-[100px]">
            {match.home_team}
          </span>
          {isFinished && match.home_score != null && match.away_score != null ? (
            <span className="font-condensed font-bold text-[13px] text-[#7a7060] shrink-0">
              {match.home_score} – {match.away_score}
            </span>
          ) : (
            <span className="text-[9px] text-[#7a7060] font-semibold shrink-0">vs</span>
          )}
          <span className="font-condensed font-bold text-[15px] truncate max-w-[100px]">
            {match.away_team}
          </span>
        </div>
        <span className="text-[10px] text-[#7a7060] shrink-0 flex items-center gap-1">
          {isLocked && <span title="Låst – kickoff inden for 30 min">🔒</span>}
          {userStake != null && (
            <span className="font-condensed font-bold text-[#2C4A3E] text-[10px]">{userStake} pt</span>
          )}
          {isFinished ? 'Færdig' : formatKickoff((match as { kickoff_at?: string; kickoff?: string }).kickoff_at ?? (match as { kickoff_at?: string; kickoff?: string }).kickoff ?? '')}
        </span>
      </div>

      {/* 1-X-2 */}
      <div className="flex gap-1 px-2.5 pb-2.5">
        {(['1', 'X', '2'] as const).map((o) => {
          const active = selectedOutcome === o
          const isUserPick = isFinished && userPrediction === o
          const isCorrect = isFinished && correctOutcome === o
          const isUserCorrect = isUserPick && isCorrect

          // Finished match result styling — grøn kun hvis valg er korrekt
          let btnClass: string
          if (isFinished && (isUserPick || isCorrect)) {
            if (isUserCorrect) {
              // User picked correctly: green bg + gold border
              btnClass = 'bg-[#27ae60] border-[#B8963E] border-[2.5px] shadow-[0_0_0_1px_#B8963E]'
            } else if (isUserPick) {
              // User picked wrong: neutral/red — IKKE grøn
              btnClass = 'bg-[#E8E0D4] border-[#c0392b]/40 border-[2px]'
            } else {
              // Correct result user didn't pick: gold border on neutral bg
              btnClass = 'bg-[#F2EDE4] border-[#B8963E] border-[2.5px]'
            }
          } else if (active) {
            btnClass = 'bg-[#1a3329] border-[#1a3329]'
          } else {
            btnClass = 'bg-[#F2EDE4] border-black/10 hover:border-[#2C4A3E]'
          }

          const textLight = active || isUserPick
          const sub =
            o === '1' ? firstWord(match.home_team) : o === '2' ? firstWord(match.away_team) : 'Uafgjort'
          return (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(o)}
              className={`flex-1 py-1.5 border-[1.5px] rounded-md flex flex-col items-center gap-0.5 transition-all ${btnClass} ${disabled ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`font-condensed text-[17px] font-bold leading-none ${
                  textLight ? 'text-white' : 'text-[#7a7060]'
                }`}
              >
                {o}
              </span>
              <span
                className={`text-[8px] font-medium ${
                  textLight ? 'text-white/60' : 'text-[#7a7060]'
                }`}
              >
                {sub}
              </span>
            </button>
          )
        })}
      </div>

      {extraBetsEnabled && (
        <ExtraBets
          match={match}
          matchId={match.id}
          isReadOnly={isReadOnly}
          extraBets={extraBets}
          onExtraChange={onExtraChange}
          fastPoints={fastPoints}
          userExtraPicks={userExtraPicks}
        />
      )}
    </div>
  )
}

export default function AfgivBets({
  gameId,
  roundId,
  gameName,
  round,
  matches,
  existingBets,
  bettingBalance,
  tickerItems,
  rivalryInfo = {},
  totalMatchesInRound,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [selections, setSelections] = useState<BetEntry[]>(() => initSelections(matches, existingBets))
  const [fastPoints, setFastPoints] = useState(100)
  const [isManuel, setIsManuel] = useState(false)
  const [customPoints, setCustomPoints] = useState(150)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pointsError, setPointsError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  const isReadOnly = round.status === 'finished'

  useEffect(() => {
    setShowPanel(existingBets.length === 0)
  }, [existingBets.length])

  const isMatchLocked = useCallback((match: MatchWithOptions): boolean => {
    const kickoff = (match as { kickoff_at?: string; kickoff?: string }).kickoff_at ?? (match as { kickoff_at?: string; kickoff?: string }).kickoff
    if (!kickoff) return false
    const lockThreshold = new Date(Date.now() + 30 * 60 * 1000)
    return new Date(kickoff) < lockThreshold
  }, [])

  const matchBettingOpen = useCallback(
    (match: MatchWithOptions): boolean => {
      if (isReadOnly) return false
      if (match.status === 'finished') return false
      if (isMatchLocked(match)) return false
      return true
    },
    [isReadOnly, isMatchLocked]
  )

  const totalMatches = matches.length
  const openSelectionsCount = useMemo(
    () => selections.filter((s) => !isMatchLocked(s.match)).length,
    [selections, isMatchLocked]
  )
  const totalPoints = selections.reduce((sum, s) => {
    const main = s.points
    const extra = s.extraBets.reduce((es, eb) => es + eb.points, 0)
    return sum + main + extra
  }, 0)
  const progressPct = totalMatches > 0 ? (selections.length / totalMatches) * 100 : 0
  const effectiveFastPoints = isManuel ? customPoints : fastPoints
  const extraBetsEnabled = true
  const totalExistingStake = existingBets.reduce((sum, b) => sum + (b.stake ?? 0), 0)
  const totalNewStake = selections.reduce((sum, s) => {
    const main = s.points ?? 0
    const extra = s.extraBets.reduce((es, eb) => es + (eb.points ?? 0), 0)
    return sum + main + extra
  }, 0)
  const previewBalance = Math.max(0, bettingBalance + totalExistingStake - totalNewStake)

  const getSelection = (matchId: number) => selections.find((s) => s.matchId === matchId)

  const selectOutcome = (matchId: number, outcome: '1' | 'X' | '2') => {
    if (isReadOnly) return
    const match = matches.find((m) => m.id === matchId)
    if (!match || !matchBettingOpen(match)) return

    const existing = getSelection(matchId)
    if (existing) {
      setSelections((prev) =>
        prev.map((s) => (s.matchId === matchId ? { ...s, outcome } : s))
      )
    } else {
      setSelections((prev) => [
        ...prev,
        {
          matchId,
          outcome,
          points: effectiveFastPoints > 0 ? effectiveFastPoints : 100,
          match,
          extraBets: [],
        },
      ])
    }
    setPointsError(null)
    setDrawerOpen(true)
  }

  const removeSelection = (matchId: number) => {
    setSelections((prev) => prev.filter((s) => s.matchId !== matchId))
    setPointsError(null)
  }

  const adjustPoints = (matchId: number, delta: number) => {
    setSelections((prev) =>
      prev.map((s) =>
        s.matchId === matchId ? { ...s, points: Math.max(10, s.points + delta), isManual: true } : s
      )
    )
    setPointsError(null)
  }

  const setPoints = (matchId: number, val: number) => {
    if (val < 10) {
      setPointsError('Minimum 10 point per valg')
      return
    }
    setSelections((prev) =>
      prev.map((s) => (s.matchId === matchId ? { ...s, points: val, isManual: true } : s))
    )
    setPointsError(null)
  }

  const updateExtraBets = (matchId: number, extras: ExtraBet[]) => {
    setSelections((prev) =>
      prev.map((s) => (s.matchId === matchId ? { ...s, extraBets: extras } : s))
    )
  }

  const adjustExtraPoints = (matchId: number, type: ExtraBetType, delta: number) => {
    setSelections((prev) =>
      prev.map((s) =>
        s.matchId === matchId
          ? {
              ...s,
              extraBets: s.extraBets.map((eb) =>
                eb.type === type ? { ...eb, points: Math.max(10, eb.points + delta) } : eb
              ),
            }
          : s
      )
    )
  }

  const updateExtraPoints = (matchId: number, type: ExtraBetType, val: number) => {
    setSelections((prev) =>
      prev.map((s) =>
        s.matchId === matchId
          ? {
              ...s,
              extraBets: s.extraBets.map((eb) =>
                eb.type === type ? { ...eb, points: Math.max(10, val) } : eb
              ),
            }
          : s
      )
    )
  }

  const setFastPointsMode = (val: number) => {
    if (val === 0) {
      setIsManuel(true)
      setFastPoints(100)
    } else {
      setIsManuel(false)
      setFastPoints(val)
      setSelections((prev) =>
        prev.map((s) => ({
          ...s,
          points: s.isManual ? s.points : val,
        }))
      )
    }
  }

  async function handleSubmit() {
    const openSelections = selections.filter((s) => !isMatchLocked(s.match))
    if (openSelections.length === 0) {
      toast('Ingen åbne kampe at afgive bets på', 'error')
      return
    }
    const openPoints = openSelections.reduce((sum, s) => {
      const main = s.points
      const extra = s.extraBets.reduce((es, eb) => es + eb.points, 0)
      return sum + main + extra
    }, 0)
    if (openPoints > bettingBalance) {
      toast(`Ikke nok credits. Du har ${bettingBalance} pt.`, 'error')
      return
    }

    const payload = {
      game_id: gameId,
      bets: [
        ...openSelections.map((s) => ({
          match_id: s.matchId,
          bet_type: 'match_result' as const,
          prediction: s.outcome,
          stake: s.points,
        })),
        ...openSelections.flatMap((s) =>
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

  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      {/* Ticker — fuld bredde */}
      {tickerItems.length > 0 && <GameTicker items={tickerItems} />}

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="w-full bg-[#c0392b]/15 border-b border-[#c0392b]/30 px-4 py-3 text-[#c0392b] text-sm">
          <div className="max-w-[960px] mx-auto">Denne runde er lukket for valg</div>
        </div>
      )}

      {/* Page header — fuld bredde, indhold centeret */}
      <div className="w-full bg-white border-b border-black/10">
        <div className="max-w-[960px] mx-auto px-4 py-3">
          <Link href={`/games/${gameId}`} className="text-[13px] text-[#888] no-underline block mb-2">← Tilbage til spilrum</Link>
          <p className="text-[9px] font-bold tracking-widest text-[#7a7060] uppercase mb-1">
            {gameName} · {round.name}
          </p>
          <h1 className="font-condensed text-[32px] font-extrabold text-[#1a3329] leading-none">
            Afgiv dine valg
          </h1>
          <p className="text-[11px] text-[#7a7060] mt-1">
            {totalMatches} kampe
          </p>
        </div>
      </div>

      {/* Centeret split-layout — flex så sticky virker */}
      <div className="max-w-[960px] mx-auto flex flex-col md:flex-row gap-0" style={{ alignItems: 'flex-start' }}>
        {/* Venstre — kampe (scroller normalt) */}
        <div className="w-full md:flex-1 py-3.5 px-5 pb-28 md:pb-24 border-r-0 md:border-r border-black/10 min-w-0">
          <div className="mb-4">
            <LiveMatches
              roundId={roundId}
              gameId={gameId}
              gameName={gameName}
              roundName={round.name}
            />
          </div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[9px] font-bold tracking-widest text-[#7a7060] uppercase">
              Vælg udfald
            </span>
            <div className="flex items-center gap-2">
              <div className="w-[80px] h-0.5 bg-[#E8E0D4] rounded overflow-hidden">
                <div
                  className="h-full bg-[#2C4A3E] rounded transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="font-condensed text-xs font-bold text-[#1a3329]">
                {selections.length} / {totalMatches}
              </span>
            </div>
          </div>

          {matches.map((match) => {
            const matchBet = existingBets.find(
              (b) => b.match_id === match.id && b.bet_type === 'match_result'
            )
            const extraPicks: Record<string, string> = {}
            for (const b of existingBets) {
              if (b.match_id === match.id && EXTRA_BET_TYPES.includes(b.bet_type as ExtraBetType)) {
                extraPicks[b.bet_type] = b.prediction
              }
            }
            return (
              <MatchCard
                key={match.id}
                match={match}
                selectedOutcome={getSelection(match.id)?.outcome ?? null}
                onSelect={(o) => selectOutcome(match.id, o)}
                disabled={isReadOnly || !matchBettingOpen(match)}
                isLocked={isMatchLocked(match)}
                extraBetsEnabled={extraBetsEnabled}
                isReadOnly={isReadOnly}
                extraBets={getSelection(match.id)?.extraBets ?? []}
                onExtraChange={updateExtraBets}
                fastPoints={effectiveFastPoints}
                userPrediction={(matchBet?.prediction as '1' | 'X' | '2') ?? null}
                userStake={matchBet?.stake ?? getSelection(match.id)?.points ?? null}
                userExtraPicks={extraPicks}
                rivalry={rivalryInfo[match.id]}
                userPoints={bettingBalance}
                totalMatches={totalMatchesInRound ?? totalMatches}
              />
            )
          })}
        </div>

        {/* Højre — sticky panel (altid synligt) */}
        <div
          className="w-full md:w-[290px] shrink-0"
          style={{ position: 'sticky', top: 16, alignSelf: 'flex-start' }}
        >
          {/* Credits boks øverst */}
          {!isReadOnly && (
            <div
              className="bg-white border border-black/10 rounded-lg px-4 py-4 mb-3 flex justify-between gap-3"
            >
              <div>
                <p className="text-[11px] font-semibold tracking-[0.05em] uppercase text-[#7a7060] mb-1">
                  Dine credits
                </p>
                <p className="font-condensed text-[22px] font-bold text-[#1a3329] leading-tight">
                  {showPanel ? previewBalance : Math.max(0, bettingBalance)} pt
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold tracking-[0.05em] uppercase text-[#7a7060] mb-1">
                  Deadline
                </p>
                <p
                  className={`font-condensed text-[22px] font-bold leading-tight ${
                    round.betting_closes_at && new Date(round.betting_closes_at) < new Date()
                      ? 'text-[#c0392b]'
                      : 'text-[#1a3329]'
                  }`}
                >
                  {deadline.time}
                </p>
                <p className="text-[10px] text-[#7a7060] mt-0.5">{deadline.date}</p>
              </div>
            </div>
          )}

          {/* Dine valg — kompakt eller fuldt panel */}
          {!showPanel && !isReadOnly && existingBets.length > 0 ? (
            <div
              className="flex justify-between items-center py-3 px-4 bg-white border border-black/10 rounded-lg"
              style={{ borderColor: '#e5e7eb' }}
            >
              <div>
                <p className="text-[13px] font-semibold text-[#1a3329]">
                  {existingBets.filter((b) => b.bet_type === 'match_result').length} valg afgivet
                </p>
                <p className="text-[12px] text-[#888]">
                  {totalExistingStake} pt brugt · {Math.max(0, bettingBalance)} pt tilbage
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPanel(true)}
                className="font-condensed text-[12px] font-bold text-[#2C4A3E] px-3 py-2 border border-[#2C4A3E] rounded hover:bg-[#2C4A3E]/10 transition-colors"
              >
                Ændr valg
              </button>
            </div>
          ) : (
          <div
            className={`
              flex flex-col bg-white overflow-hidden
              md:max-h-[calc(100vh-120px)]
              border-t-2 md:border-t border-[#2C4A3E] md:border border-black/10
              fixed bottom-0 left-0 right-0 z-90 md:relative md:z-auto
              max-h-[70vh] md:max-h-none
              shadow-[0_-8px_32px_rgba(0,0,0,0.15)] md:shadow-none
              rounded-t-[14px] md:rounded-lg
              transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${drawerOpen ? 'translate-y-0' : 'translate-y-[calc(100%-56px)] md:translate-y-0'}
            `}
          >
            {/* Drawer-handle på mobil */}
            <button
              type="button"
              onClick={() => setDrawerOpen((o) => !o)}
              className="md:hidden w-full py-2 flex justify-center shrink-0"
            >
              <span className="w-8 h-0.5 bg-black/10 rounded block" />
            </button>

            {/* Header */}
          <div
            className="flex items-center justify-between px-3.5 py-3 border-b border-black/10 shrink-0 cursor-pointer md:cursor-default"
            onClick={() => window.innerWidth <= 700 && setDrawerOpen((o) => !o)}
          >
            <div className="flex items-center gap-2">
              <span className="font-condensed text-sm font-bold text-[#1a3329] tracking-widest uppercase">
                🎯 Dine valg
              </span>
              {!isReadOnly && existingBets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPanel(false)}
                  className="text-[11px] font-semibold text-[#7a7060] hover:text-[#1a3329]"
                >
                  Luk
                </button>
              )}
            </div>
            <span className="font-condensed text-[22px] font-extrabold text-[#B8963E] leading-none">
              {selections.length}
            </span>
          </div>

          {/* Point per valg */}
          {!isReadOnly && (
            <div className="px-3 py-2.5 border-b border-black/10 bg-[#F2EDE4] shrink-0">
              <p className="text-[8px] font-bold tracking-widest text-[#7a7060] uppercase mb-1.5">
                Point per valg
              </p>
              <div className="grid grid-cols-4 gap-1">
                {[50, 100, 200, 0].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFastPointsMode(v)}
                    className={`py-1.5 border-[1.5px] rounded text-[11px] font-semibold transition-all ${
                      (v === 0 ? isManuel : !isManuel && fastPoints === v)
                        ? 'bg-[#1a3329] border-[#1a3329] text-[#F2EDE4]'
                        : 'bg-white border-black/10 text-[#7a7060] hover:border-[#2C4A3E] hover:text-[#1a3329]'
                    }`}
                  >
                    {v === 0 ? 'Manuel' : `${v} pt`}
                  </button>
                ))}
              </div>
              {isManuel && (
                <input
                  type="number"
                  min={10}
                  value={customPoints}
                  onChange={(e) => setCustomPoints(Math.max(10, parseInt(e.target.value) || 10))}
                  placeholder="Antal point..."
                  className="mt-1.5 w-full text-center font-condensed text-sm font-bold text-[#1a3329] border border-black/10 rounded px-2 py-1 bg-white"
                />
              )}
            </div>
          )}

          {/* Scroll-liste */}
          <div className="flex-1 overflow-y-auto py-1.5 min-h-0">
            {selections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2 text-[#7a7060] text-center px-5">
                <span className="text-3xl opacity-30">🎯</span>
                <p className="text-xs leading-relaxed">
                  Vælg et udfald til venstre
                  <br />
                  for at tilføje til dine valg
                </p>
              </div>
            ) : (
              selections.map((entry) => (
                <div
                  key={entry.matchId}
                  className="border-b border-black/10"
                  style={{ animation: 'slideInRight 0.18s ease' }}
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[11px] font-semibold flex-1 truncate">
                        {entry.match.home_team} vs {entry.match.away_team}
                      </span>
                      <span className="font-condensed text-[13px] font-bold text-[#2C4A3E] bg-[#2C4A3E]/10 rounded px-1.5">
                        {entry.outcome}
                      </span>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => removeSelection(entry.matchId)}
                          className="text-[11px] text-[#7a7060] opacity-50 hover:opacity-100 hover:text-red-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!isReadOnly ? (
                        <>
                          <button
                            type="button"
                            onClick={() => adjustPoints(entry.matchId, -50)}
                            className="w-6 h-6 border border-black/10 rounded bg-[#F2EDE4] text-[#1a3329] font-bold text-sm flex items-center justify-center"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={10}
                            value={entry.points}
                            onChange={(e) =>
                              setPoints(entry.matchId, Math.max(10, parseInt(e.target.value) || 10))
                            }
                            className="flex-1 text-center font-condensed text-[15px] font-bold text-[#1a3329] border border-black/10 rounded bg-[#F2EDE4] h-6"
                          />
                          <span className="text-[10px] text-[#7a7060] font-semibold">pt</span>
                          <button
                            type="button"
                            onClick={() => adjustPoints(entry.matchId, 50)}
                            className="w-6 h-6 border border-black/10 rounded bg-[#F2EDE4] text-[#1a3329] font-bold text-sm flex items-center justify-center"
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <span className="font-condensed text-[15px] font-bold text-[#1a3329]">
                          {entry.points} pt
                        </span>
                      )}
                    </div>
                  </div>
                  {entry.extraBets.length > 0 && (
                    <div className="mx-3 mb-2 border border-black/[0.08] rounded-md overflow-hidden">
                      {entry.extraBets.map((eb, i) => (
                        <div
                          key={eb.type}
                          className={`flex items-center gap-2 px-2.5 py-1.5 ${
                            i > 0 ? 'border-t border-black/[0.07]' : ''
                          } bg-[#F2EDE4]/60`}
                        >
                          <span className="text-[9px] font-semibold text-[#7a7060] w-[70px] shrink-0 leading-tight">
                            {EXTRA_LABELS[eb.type]}
                          </span>
                          <span className="font-condensed text-[12px] font-bold text-[#2C4A3E] bg-[#2C4A3E]/10 rounded px-1.5 shrink-0">
                            {getExtraBetLabel(eb.type, eb.prediction)}
                          </span>
                          <div className="flex items-center gap-1 ml-auto">
                            {!isReadOnly ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => adjustExtraPoints(entry.matchId, eb.type, -50)}
                                  className="w-5 h-5 border border-black/10 rounded bg-white text-[#1a3329] text-xs font-bold flex items-center justify-center"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={10}
                                  value={eb.points}
                                  onChange={(e) =>
                                    updateExtraPoints(
                                      entry.matchId,
                                      eb.type,
                                      parseInt(e.target.value) || 10
                                    )
                                  }
                                  className="w-12 text-center font-condensed text-[13px] font-bold text-[#1a3329] border border-black/10 rounded bg-white h-5"
                                />
                                <span className="text-[9px] text-[#7a7060] font-semibold">pt</span>
                                <button
                                  type="button"
                                  onClick={() => adjustExtraPoints(entry.matchId, eb.type, 50)}
                                  className="w-5 h-5 border border-black/10 rounded bg-white text-[#1a3329] text-xs font-bold flex items-center justify-center"
                                >
                                  +
                                </button>
                              </>
                            ) : (
                              <span className="font-condensed text-[12px] font-bold text-[#1a3329]">
                                {eb.points} pt
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t-2 border-black/10 px-3 py-2.5 bg-white shrink-0">
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-[#7a7060] font-semibold">Antal valg</span>
              <span className="font-condensed text-base font-bold text-[#1a3329]">
                {selections.length}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-[10px] text-[#7a7060] font-semibold">Samlet point</span>
              <span className="font-condensed text-base font-bold text-[#B8963E]">
                {totalPoints} pt
              </span>
            </div>
            <p
              className="text-[9px] text-center mb-2 leading-relaxed"
              style={{ color: selections.length === totalMatches ? '#B8963E' : '#7a7060' }}
            >
              {selections.length === totalMatches
                ? '⭐ Full house! Du får +25 pt bonus.'
                : '🔒 Dine point-faktorer afsløres efter deadline.'}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={openSelectionsCount === 0 || isSubmitting || isReadOnly || totalPoints > bettingBalance}
              className="w-full h-[42px] rounded-lg font-condensed text-[15px] font-bold tracking-widest bg-[#B8963E] text-[#1a3329] disabled:bg-[#E8E0D4] disabled:text-[#7a7060] hover:bg-[#d4aa55] hover:-translate-y-px transition-all disabled:cursor-not-allowed disabled:transform-none"
            >
              LÅS DINE VALG
            </button>
            {selections.length > 0 && selections.length < totalMatches && (
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded border border-dashed border-[#B8963E]/40 bg-[#B8963E]/7">
                <span className="text-[9px] text-[#B8963E] font-semibold">
                  ⭐ Vælg alle {totalMatches} kampe og få +25 pt bonus!
                </span>
              </div>
            )}
          </div>
        </div>
          )}
        </div>
      </div>

      {pointsError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#c0392b] text-white px-4 py-2 rounded-lg text-sm font-medium z-[110]">
          {pointsError}
        </div>
      )}
    </div>
  )
}
