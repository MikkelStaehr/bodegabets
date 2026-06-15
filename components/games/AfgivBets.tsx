'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Match, Bet } from '@/types'
import { BET_TYPE_LABELS, PREDICTION_LABELS } from '@/lib/betTypes'
import { isBetCorrect } from '@/lib/betUtils'
import { useToast } from '@/components/ui/Toast'
import { formatKickoff, matchdayKey, matchdayLabel } from '@/lib/dateUtils'
import GameTicker from '@/components/games/GameTicker'
import BetSlipGuide from '@/components/games/BetSlipGuide'

type MatchWithOptions = Match

type ExtraBetType = 'goals_3plus' | 'clean_sheet' | 'win_margin'

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
  isReplacement?: boolean
}

const EXTRA_BET_ROWS = [
  {
    key: 'goals_3plus' as const,
    label: 'Scorer 3+ mål',
    opts: [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
    ],
  },
  {
    key: 'clean_sheet' as const,
    label: 'Clean sheet',
    opts: [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
    ],
  },
  {
    key: 'win_margin' as const,
    label: 'Vinder med 2+',
    opts: [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
    ],
  },
] as const

function getExtraBetLabel(type: ExtraBetType, value: string): string {
  const row = EXTRA_BET_ROWS.find((r) => r.key === type)
  const opt = row?.opts.find((o) => o.value === value)
  return opt?.label ?? value
}

const EXTRA_BET_TYPES: ExtraBetType[] = ['goals_3plus', 'clean_sheet', 'win_margin']

type RivalryInfo = { rivalry_name: string; multiplier: number }

type BetDistribution = Record<number, { '1': number; 'X': number; '2': number; total: number; odds?: { '1': number | null; 'X': number | null; '2': number | null } }>


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
  tickerItems: string[]
  rivalryInfo?: Record<number, RivalryInfo>
  totalMatchesInRound?: number
  betDistribution?: BetDistribution
  blockInfo?: { block_number: number; block_name: string; is_last_in_block: boolean } | null
  /** Samlet credit-budget for blokken (VM: 1000 delt over blokkens 2 runder). */
  blockBudget?: number
  /** Allerede brugt i blokkens ANDRE runder (trækkes fra budgettet her). */
  blockSpentElsewhere?: number
  /** True hvis ubrugte credits ruller videre til en senere runde i samme blok
   *  (dvs. det er fair at gemme). Så bliver "ubrugt"-beskeden neutral i stedet
   *  for en advarsel. */
  creditsRollOver?: boolean
  /** 🍀 Spilleren er blandt de nederste → +20% på gevinster i denne blok. */
  losersLuckActive?: boolean
  submitApiPath?: string
}

function initSelections(_matches: MatchWithOptions[], _existing: Bet[]): BetEntry[] {
  // Existing bets are already paid — don't load them into selections.
  // Only new/changed bets appear in selections and count towards credits.
  return []
}



function formatDeadline(iso: string | null) {
  if (!iso) return { time: '—', date: '' }
  const d = new Date(iso)
  return {
    time: d.toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', weekday: 'short', day: 'numeric', month: 'short' }),
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

/* ─── Inline Extra Bets (used on match cards) ─── */
function InlineExtraBets({
  matchId,
  sel,
  isRivalry,
  toggleExtra,
  adjustExtraStake,
  setExtraStake,
}: {
  matchId: number
  sel: BetEntry
  isRivalry: boolean
  toggleExtra: (matchId: number, key: ExtraBetType) => void
  adjustExtraStake: (matchId: number, type: ExtraBetType, delta: number) => void
  setExtraStake: (matchId: number, type: ExtraBetType, val: number) => void
}) {
  const [open, setOpen] = useState(sel.extraBets.length > 0)

  // Ekstra-valg er et tillæg til DIN sejr — kun relevant når du har valgt en
  // vinder (1/2). På kryds (X) er der ingen vinder at tilføje til.
  if (sel.outcome !== '1' && sel.outcome !== '2') return null
  const winnerTeam = sel.outcome === '1' ? sel.match.home_team : sel.match.away_team

  return (
    <div className={`border-t ${isRivalry ? 'border-gold/20' : 'border-black/[0.06]'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left"
      >
        <span className={`text-[9px] font-bold tracking-widest uppercase flex-1 ${isRivalry ? 'text-gold/70' : 'text-[var(--color-warm-taupe)]'}`}>
          + Ekstra valg
        </span>
        <span className={`text-[9px] transition-transform ${isRivalry ? 'text-gold/50' : 'text-[var(--color-warm-taupe)]'} ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {EXTRA_BET_ROWS.map((row) => {
            const active = sel.extraBets.some((eb) => eb.type === row.key)
            const cls = active
              ? (isRivalry ? 'bg-gold border-gold text-[var(--color-dark-green)]' : 'bg-[var(--color-card-green)] border-[#2C4A3E] text-white')
              : (isRivalry ? 'bg-[var(--color-card-green)] border-gold/20 text-[var(--color-cream)]/70 hover:border-gold/50' : 'bg-white border-black/10 text-[var(--color-warm-taupe)] hover:border-[#2C4A3E] hover:text-[var(--color-dark-green)]')
            return (
              <div key={row.key}>
                <button
                  type="button"
                  onClick={() => toggleExtra(matchId, row.key)}
                  className={`w-full py-1.5 px-2 border-[1.5px] rounded text-[11px] font-semibold transition-all text-left ${cls}`}
                >
                  {active ? '✓ ' : '+ '}{winnerTeam} {row.label.toLowerCase()}
                </button>
                {active && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => adjustExtraStake(matchId, row.key, -50)}
                      className={`w-6 h-6 border rounded font-bold text-sm flex items-center justify-center ${
                        isRivalry
                          ? 'border-gold/30 bg-[var(--color-card-green)] text-[var(--color-cream)]'
                          : 'border-black/10 bg-[var(--color-cream)] text-[var(--color-dark-green)]'
                      }`}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={10}
                      value={sel.extraBets.find((eb) => eb.type === row.key)?.points ?? 50}
                      onChange={(e) => setExtraStake(matchId, row.key, parseInt(e.target.value) || 10)}
                      className={`w-14 text-center font-condensed text-[13px] font-bold border rounded h-6 ${
                        isRivalry
                          ? 'border-gold/30 bg-[var(--color-card-green)] text-[var(--color-cream)]'
                          : 'border-black/10 bg-[var(--color-cream)] text-[var(--color-dark-green)]'
                      }`}
                    />
                    <span className={`text-[10px] font-semibold ${isRivalry ? 'text-[var(--color-cream)]/50' : 'text-[var(--color-warm-taupe)]'}`}>
                      credits
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustExtraStake(matchId, row.key, 50)}
                      className={`w-6 h-6 border rounded font-bold text-sm flex items-center justify-center ${
                        isRivalry
                          ? 'border-gold/30 bg-[var(--color-card-green)] text-[var(--color-cream)]'
                          : 'border-black/10 bg-[var(--color-cream)] text-[var(--color-dark-green)]'
                      }`}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type ExtraBetData = { prediction: string; stake: number; points_earned: number | null; result: string | null; odds: number | null }

/* ─── Read-only Extra Bets for Finished/Locked Matches ─── */
function ExtraBetRows({
  match,
  userExtraPicks,
  userExtraBetData,
  isFinished,
}: {
  match: Match
  userExtraPicks: Record<string, string>
  userExtraBetData: Record<string, ExtraBetData>
  isFinished: boolean
}) {
  if (Object.keys(userExtraPicks).length === 0) return null
  const teamName = (side: string) => side === '1' ? match.home_team : match.away_team
  return (
    <div className="px-3 pb-2 pt-1 flex flex-col gap-0.5 border-t border-black/[0.06]">
      {EXTRA_BET_ROWS
        .filter((row) => userExtraPicks[row.key])
        .map((row) => {
          const userValue = userExtraPicks[row.key]
          const betData = userExtraBetData[row.key]
          const isWin = betData?.result === 'win'
          const isLoss = betData?.result === 'loss'
          const resultIcon = !isFinished ? '—' : isWin ? '✓' : '✗'
          const resultColor = !isFinished ? 'text-[var(--color-muted)]' : isWin ? 'text-[var(--color-green-dark)]' : 'text-[var(--color-red-dark)]'

          return (
            <div key={row.key} className="flex items-center gap-2 py-0.5">
              <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--color-warm-taupe)] w-[72px] shrink-0">
                {row.label}
              </span>
              <span className="text-[10px] font-medium text-[#5C5C4A] truncate flex-1">
                {teamName(userValue)} ({userValue})
              </span>
              {betData?.odds != null && (
                <span className="text-[9px] font-bold text-[var(--color-muted)] shrink-0">×{betData.odds.toFixed(2)}</span>
              )}
              {isFinished && betData && (isWin || isLoss) && (
                <span className={`text-[9px] font-bold shrink-0 ${isWin ? 'text-[var(--color-green-dark)]' : 'text-[var(--color-red-dark)]'}`}>
                  {isWin ? `+${betData.points_earned ?? 0}` : `-${betData.stake}`}
                </span>
              )}
              <span className={`text-[11px] font-bold shrink-0 w-4 text-center ${resultColor}`}>
                {resultIcon}
              </span>
            </div>
          )
        })}
    </div>
  )
}

/* ─── Match Card (shared between mobile + desktop left column) ─── */
function MatchCard({
  match,
  sel,
  rivalry,
  isFinished,
  isLocked,
  isOpen,
  isReadOnly,
  isEditing,
  correctOutcome,
  userPrediction,
  userExtraPicks,
  userExtraBetData,
  matchResultBet,
  selectOutcome,
  toggleExtra,
  adjustExtraStake,
  setExtraStake,
  adjustStake,
  setStake,
  onStartEdit,
  onCancelEdit,
  showInlineStake,
  distribution,
}: {
  match: MatchWithOptions
  sel: BetEntry | undefined
  rivalry: RivalryInfo | undefined
  isFinished: boolean
  isLocked: boolean
  isOpen: boolean
  isReadOnly: boolean
  isEditing: boolean
  correctOutcome: '1' | 'X' | '2' | null
  userPrediction: '1' | 'X' | '2' | null
  userExtraPicks: Record<string, string>
  userExtraBetData: Record<string, ExtraBetData>
  matchResultBet: Bet | undefined
  selectOutcome: (matchId: number, outcome: '1' | 'X' | '2') => void
  toggleExtra: (matchId: number, key: ExtraBetType) => void
  adjustExtraStake: (matchId: number, type: ExtraBetType, delta: number) => void
  setExtraStake: (matchId: number, type: ExtraBetType, val: number) => void
  adjustStake: (matchId: number, delta: number) => void
  setStake: (matchId: number, val: number) => void
  onStartEdit: (matchId: number) => void
  onCancelEdit: (matchId: number) => void
  showInlineStake: boolean
  distribution?: { '1': number; 'X': number; '2': number; total: number; odds?: { '1': number | null; 'X': number | null; '2': number | null } }
}) {
  const isRivalry = !!rivalry
  const hasExistingBet = isOpen && !!matchResultBet
  const displayOutcome = isFinished ? userPrediction : (sel?.outcome ?? userPrediction)

  const cardBg = isRivalry ? 'bg-[var(--color-dark-green)]' : 'bg-white'
  const hasSelection = !!sel || (!isFinished && !!userPrediction)
  const cardBorder = isRivalry
    ? 'border-gold'
    : hasSelection
      ? 'border-[#2C4A3E] shadow-[0_0_0_1px_#2C4A3E]'
      : 'border-black/10'
  const textPrimary = isRivalry ? 'text-[var(--color-cream)]' : 'text-[var(--color-dark-green)]'
  const textSecondary = isRivalry ? 'text-[var(--color-cream)]/50' : 'text-[var(--color-warm-taupe)]'
  const scoreSep = isRivalry ? 'text-[var(--color-cream)]/60' : 'text-[var(--color-warm-taupe)]'

  return (
    <div className={`${cardBg} border rounded-sm mb-2 overflow-hidden transition-all ${cardBorder}`}>
      {/* Rivalry badge */}
      {isRivalry && (
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-0.5">
          <span className="text-[12px]">🔥</span>
          <span className="font-condensed text-[11px] font-bold text-gold uppercase tracking-widest">
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
              btnClass = 'bg-[var(--color-green-dark)] border-gold border-[2.5px] shadow-[0_0_0_1px_#B8963E]'
            } else if (isUserPick) {
              btnClass = 'bg-[var(--color-green-dark)] border-[var(--color-green-dark)]'
            } else if (isRivalry) {
              btnClass = 'bg-[var(--color-card-green)] border-gold border-[2.5px]'
            } else {
              btnClass = 'bg-[var(--color-cream)] border-gold border-[2.5px]'
            }
          } else if (active) {
            btnClass = isRivalry
              ? 'bg-gold border-gold'
              : 'bg-[var(--color-dark-green)] border-[#1a3329]'
          } else {
            btnClass = isRivalry
              ? 'bg-[var(--color-card-green)] border-gold/30 hover:border-gold'
              : 'bg-[var(--color-cream)] border-black/10 hover:border-[#2C4A3E]'
          }

          const textLight = active || isUserPick
          const sub =
            o === '1' ? firstWord(match.home_team) : o === '2' ? firstWord(match.away_team) : 'Uafgjort'
          const disabled = isReadOnly || !isOpen || (hasExistingBet && !isEditing)

          return (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => selectOutcome(match.id, o)}
              className={`flex-1 py-1.5 border-[1.5px] rounded-md flex flex-col items-center gap-0.5 transition-all ${btnClass} ${disabled ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`font-condensed text-[17px] font-bold leading-none ${
                textLight
                  ? isRivalry ? 'text-[var(--color-dark-green)]' : 'text-white'
                  : isRivalry ? 'text-[var(--color-cream)]/70' : 'text-[var(--color-warm-taupe)]'
              }`}>
                {o}
              </span>
              <span className={`text-[8px] font-medium ${
                textLight
                  ? isRivalry ? 'text-[var(--color-dark-green)]/60' : 'text-white/60'
                  : isRivalry ? 'text-[var(--color-cream)]/40' : 'text-[var(--color-warm-taupe)]'
              }`}>
                {sub}
              </span>
            </button>
          )
        })}
      </div>

      {/* Extra bets — collapsible, only for open matches with a selection */}
      {isOpen && sel && (
        <InlineExtraBets
          matchId={match.id}
          sel={sel}
          isRivalry={isRivalry}
          toggleExtra={toggleExtra}
          adjustExtraStake={adjustExtraStake}
          setExtraStake={setExtraStake}
        />
      )}

      {/* Existing extra bets on open match with no new selection — read-only */}
      {isOpen && !sel && Object.keys(userExtraPicks).length > 0 && (
        <div className={`px-3 pb-2 ${isRivalry ? 'border-t border-gold/20' : ''}`}>
          {EXTRA_BET_ROWS
            .filter((row) => userExtraPicks[row.key])
            .map((row) => (
              <div key={row.key} className="mb-1">
                <span className={`text-[9px] font-bold tracking-wider uppercase mb-0.5 block ${isRivalry ? 'text-gold/70' : 'text-[var(--color-warm-taupe)]'}`}>
                  {row.label}
                </span>
                <div className="flex gap-1">
                  {row.opts.map((opt) => {
                    const isUserPick = userExtraPicks[row.key] === opt.value
                    const cls = isUserPick
                      ? isRivalry
                        ? 'bg-gold border-gold text-[var(--color-dark-green)]'
                        : 'bg-[var(--color-card-green)] border-[#2C4A3E] text-white'
                      : isRivalry
                        ? 'bg-[var(--color-card-green)] border-gold/20 text-[var(--color-cream)]/40'
                        : 'bg-white border-black/10 text-[var(--color-warm-taupe)]/40'
                    return (
                      <button key={opt.value} type="button" disabled className={`flex-1 py-1 border-[1.5px] rounded text-[10px] font-semibold cursor-not-allowed opacity-80 ${cls}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Finished match: show user extra picks read-only */}
      {isFinished && <ExtraBetRows match={match} userExtraPicks={userExtraPicks} userExtraBetData={userExtraBetData} isFinished={true} />}

      {/* Inline stake — mobile only (controlled via showInlineStake) */}
      {showInlineStake && isOpen && sel && (
        <div className={`flex items-center gap-2 px-3 py-2 ${isRivalry ? 'border-t border-gold/20' : 'border-t border-black/[0.06]'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isRivalry ? 'text-gold/70' : 'text-[var(--color-warm-taupe)]'}`}>
            Stake
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => adjustStake(match.id, -50)}
              className={`w-7 h-7 border rounded font-bold text-sm flex items-center justify-center ${
                isRivalry
                  ? 'border-gold/30 bg-[var(--color-card-green)] text-[var(--color-cream)]'
                  : 'border-black/10 bg-[var(--color-cream)] text-[var(--color-dark-green)]'
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
                  ? 'border-gold/30 bg-[var(--color-card-green)] text-[var(--color-cream)]'
                  : 'border-black/10 bg-[var(--color-cream)] text-[var(--color-dark-green)]'
              }`}
            />
            <span className={`text-[10px] font-semibold ${isRivalry ? 'text-[var(--color-cream)]/50' : 'text-[var(--color-warm-taupe)]'}`}>
              credits
            </span>
            <button
              type="button"
              onClick={() => adjustStake(match.id, 50)}
              className={`w-7 h-7 border rounded font-bold text-sm flex items-center justify-center ${
                isRivalry
                  ? 'border-gold/30 bg-[var(--color-card-green)] text-[var(--color-cream)]'
                  : 'border-black/10 bg-[var(--color-cream)] text-[var(--color-dark-green)]'
              }`}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Open match with existing bet: show stake + Ændre/Fortryd button */}
      {hasExistingBet && (
        <div className={`flex items-center justify-between px-3 py-1.5 ${isRivalry ? 'border-t border-gold/20' : 'border-t border-black/[0.06]'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isRivalry ? 'text-gold/70' : 'text-[var(--color-warm-taupe)]'}`}>
            Dit valg
          </span>
          <div className="flex items-center gap-2">
            <span className={`font-condensed text-[14px] font-bold ${isRivalry ? 'text-[var(--color-cream)]/70' : 'text-[var(--color-warm-taupe)]'}`}>
              {matchResultBet.stake} credits
            </span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => isEditing ? onCancelEdit(match.id) : onStartEdit(match.id)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                  isEditing
                    ? isRivalry
                      ? 'text-[var(--color-cream)]/70 hover:text-[var(--color-cream)] border border-gold/30'
                      : 'text-[var(--color-red-dark)] hover:text-[var(--color-red-dark)]/80 border border-[#c0392b]/30'
                    : isRivalry
                      ? 'text-gold hover:text-gold/80 border border-gold/30'
                      : 'text-[#2C4A3E] hover:text-[#2C4A3E]/80 border border-[#2C4A3E]/30'
                }`}
              >
                {isEditing ? 'Fortryd' : 'Ændre \u2192'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Locked match: show stake read-only */}
      {!isOpen && matchResultBet && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-black/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-warm-taupe)]">
            Stake
          </span>
          <span className="font-condensed text-[14px] font-bold text-[var(--color-warm-taupe)]">
            {matchResultBet.stake} credits
          </span>
        </div>
      )}

      {/* Bet fordeling — kun på låste kampe */}
      {!isOpen && distribution && distribution.total > 0 && (
        <div className={`px-3 pb-2.5 pt-1 border-t border-black/[0.06]`}>
          <div className="flex gap-1 items-center">
            {(['1', 'X', '2'] as const).map((opt) => {
              const count = distribution[opt] ?? 0
              const pct = distribution.total > 0 ? Math.round((count / distribution.total) * 100) : 0
              const isHighest = count === Math.max(distribution['1'], distribution['X'], distribution['2'])
              const odds = distribution.odds?.[opt] ?? null
              return (
                <div key={opt} className="flex-1 text-center">
                  <div className="font-condensed text-[11px] font-bold text-[var(--color-muted)] uppercase">
                    {opt}
                  </div>
                  {odds !== null && (
                    <div className="font-condensed text-[12px] text-[var(--color-muted)]">
                      {odds.toFixed(2)}
                    </div>
                  )}
                  <div className={`font-condensed text-[13px] font-bold ${isHighest && pct > 0 ? 'text-gold' : 'text-[var(--color-muted)]'}`}>
                    {pct}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ekstra bets — låste kampe (read-only) */}
      {!isOpen && !isFinished && Object.keys(userExtraPicks).length > 0 && (
        <ExtraBetRows match={match} userExtraPicks={userExtraPicks} userExtraBetData={userExtraBetData} isFinished={false} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export default function AfgivBets({
  gameId,
  roundId,
  gameName,
  round,
  matches,
  existingBets,
  userPoints,
  tickerItems,
  rivalryInfo = {},
  totalMatchesInRound,
  betDistribution,
  blockInfo,
  blockBudget = 1000,
  blockSpentElsewhere = 0,
  creditsRollOver = false,
  losersLuckActive = false,
  submitApiPath,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [selections, setSelections] = useState<BetEntry[]>(() => initSelections(matches, existingBets))
  const [editingMatchIds, setEditingMatchIds] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showUnusedWarning, setShowUnusedWarning] = useState(false)

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
  // Spænder kuponens kampe over flere danske kalenderdage? (natkampe → "i morgen").
  const spansMultipleDays = useMemo(() => {
    const days = new Set(
      matches.filter((m) => m.kickoff_at).map((m) => matchdayKey(m.kickoff_at))
    )
    return days.size > 1
  }, [matches])
  const totalPoints = useMemo(() => {
    // Eksisterende bets for kampe der IKKE er i aktive selections
    const existingStake = existingBets
      .filter((b) => !selections.some((s) => s.matchId === b.match_id))
      .reduce((sum, b) => sum + (b.stake ?? 0), 0)

    // Stake fra aktive selections (nye + ændrede) inkl. ekstra bets
    const newStake = selections.reduce((sum, s) => {
      const extraStake = s.extraBets.reduce((es, eb) => es + eb.points, 0)
      return sum + s.points + extraStake
    }, 0)

    return existingStake + newStake
  }, [selections, existingBets])
  // VM: budgettet er pr. BLOK (1000 delt over 2 runder). Det der allerede er
  // brugt i blokkens anden runde trækkes fra, så denne rundes rådige credits
  // = blockBudget − blockSpentElsewhere. For almindelige runder (uden blok)
  // er blockBudget=1000 og blockSpentElsewhere=0 → samme som før.
  const effectiveBudget = Math.max(0, blockBudget - blockSpentElsewhere)
  const displayCredits = effectiveBudget - totalPoints
  const isOverBudget = displayCredits < 0

  const getSelection = (matchId: number) => selections.find((s) => s.matchId === matchId)

  const selectOutcome = (matchId: number, outcome: '1' | 'X' | '2') => {
    if (isReadOnly) return
    const match = matches.find((m) => m.id === matchId)
    if (!match || !matchBettingOpen(match)) return

    // Check if there's an existing (already-paid) bet for this match
    const existingBet = existingBets.find(
      (b) => b.match_id === matchId && b.bet_type === 'match_result'
    )

    // Block changes on existing bets unless explicitly editing
    if (existingBet && !editingMatchIds.has(matchId)) return

    const sel = getSelection(matchId)
    if (sel) {
      if (sel.outcome === outcome) {
        // For replacements, toggle off reverts to existing bet outcome
        if (sel.isReplacement && existingBet) {
          // Revert to existing bet outcome
          setSelections((prev) =>
            prev.map((s) => {
              if (s.matchId !== matchId) return s
              const o = existingBet.prediction as '1' | 'X' | '2'
              const extraBets = (o === '1' || o === '2') ? s.extraBets.map((eb) => ({ ...eb, prediction: o })) : []
              return { ...s, outcome: o, extraBets }
            })
          )
        } else {
          setSelections((prev) => prev.filter((s) => s.matchId !== matchId))
        }
        return
      }
      setSelections((prev) =>
        prev.map((s) => {
          if (s.matchId !== matchId) return s
          // Ekstra-bets følger den nye vinder; kryds (X) rydder dem.
          const extraBets = (outcome === '1' || outcome === '2')
            ? s.extraBets.map((eb) => ({ ...eb, prediction: outcome }))
            : []
          return { ...s, outcome, extraBets }
        })
      )
    } else {
      setSelections((prev) => [
        ...prev,
        { matchId, outcome, points: 100, match, extraBets: [], isReplacement: false },
      ])
    }
  }

  const removeSelection = (matchId: number) => {
    setSelections((prev) => prev.filter((s) => s.matchId !== matchId))
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

  // "Maxe ud": skalér alle aktive indsatser (match_result + ekstra) proportionalt,
  // så de tilsammen bruger ALLE resterende credits i blokken. Eksisterende,
  // allerede-betalte bets røres ikke — der skaleres kun op til
  // (effektivt budget − allerede brugt i denne runde).
  const maxOut = useCallback(() => {
    const existingStake = existingBets
      .filter((b) => !selections.some((s) => s.matchId === b.match_id))
      .reduce((sum, b) => sum + (b.stake ?? 0), 0)
    const available = effectiveBudget - existingStake
    if (available <= 0 || selections.length === 0) return

    // Flad liste over alle aktive indsats-poster
    type Flat = { matchId: number; kind: 'main' | ExtraBetType; points: number }
    const flat: Flat[] = []
    for (const s of selections) {
      flat.push({ matchId: s.matchId, kind: 'main', points: s.points })
      for (const eb of s.extraBets) flat.push({ matchId: s.matchId, kind: eb.type, points: eb.points })
    }
    const currentNew = flat.reduce((sum, e) => sum + e.points, 0)
    if (currentNew <= 0) return

    const factor = available / currentNew
    const scaled = flat.map((e) => ({ ...e, points: Math.max(10, Math.round(e.points * factor)) }))

    // Ret afrundings-rest af, så summen rammer præcis `available` — læg den på
    // den største post (langt over 10, så min-grænsen brydes ikke).
    const diff = available - scaled.reduce((sum, e) => sum + e.points, 0)
    if (diff !== 0) {
      const idx = scaled.reduce((maxI, e, i, arr) => (e.points > arr[maxI].points ? i : maxI), 0)
      scaled[idx] = { ...scaled[idx], points: Math.max(10, scaled[idx].points + diff) }
    }

    setSelections((prev) =>
      prev.map((s) => {
        const main = scaled.find((e) => e.matchId === s.matchId && e.kind === 'main')
        return {
          ...s,
          points: main ? main.points : s.points,
          extraBets: s.extraBets.map((eb) => {
            const sc = scaled.find((e) => e.matchId === s.matchId && e.kind === eb.type)
            return sc ? { ...eb, points: sc.points } : eb
          }),
        }
      })
    )
  }, [existingBets, selections, effectiveBudget])

  const toggleExtra = (matchId: number, key: ExtraBetType) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.matchId !== matchId) return s
        // Ekstra-bets gælder hoved-bettets vinder (1=hjemme, 2=ude) — aldrig
        // modparten. På kryds (X) kan der ikke tilføjes ekstra-bets.
        if (s.outcome !== '1' && s.outcome !== '2') return s
        const existing = s.extraBets.find((eb) => eb.type === key)
        const next = existing
          ? s.extraBets.filter((eb) => eb.type !== key)
          : [...s.extraBets, { type: key, prediction: s.outcome, points: 50 }]
        return { ...s, extraBets: next }
      })
    )
  }

  const adjustExtraStake = (matchId: number, type: ExtraBetType, delta: number) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.matchId !== matchId) return s
        return {
          ...s,
          extraBets: s.extraBets.map((eb) =>
            eb.type === type ? { ...eb, points: Math.max(10, eb.points + delta) } : eb
          ),
        }
      })
    )
  }

  const setExtraStake = (matchId: number, type: ExtraBetType, val: number) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.matchId !== matchId) return s
        return {
          ...s,
          extraBets: s.extraBets.map((eb) =>
            eb.type === type ? { ...eb, points: Math.max(10, val) } : eb
          ),
        }
      })
    )
  }

  const startEditing = (matchId: number) => {
    const match = matches.find((m) => m.id === matchId)
    if (!match) return
    const existingBet = existingBets.find(
      (b) => b.match_id === matchId && b.bet_type === 'match_result'
    )
    if (!existingBet) return

    setEditingMatchIds((prev) => new Set(prev).add(matchId))

    // Load existing bet into selections as replacement
    const existingExtraBets: ExtraBet[] = existingBets
      .filter(
        (b) =>
          b.match_id === matchId &&
          EXTRA_BET_TYPES.includes(b.bet_type as ExtraBetType)
      )
      .map((b) => ({
        type: b.bet_type as ExtraBetType,
        prediction: b.prediction,
        points: b.stake,
      }))

    setSelections((prev) => [
      ...prev.filter((s) => s.matchId !== matchId),
      {
        matchId,
        outcome: existingBet.prediction as '1' | 'X' | '2',
        points: existingBet.stake,
        match,
        extraBets: existingExtraBets,
        isReplacement: true,
      },
    ])
  }

  const cancelEditing = (matchId: number) => {
    setEditingMatchIds((prev) => {
      const next = new Set(prev)
      next.delete(matchId)
      return next
    })
    setSelections((prev) => prev.filter((s) => s.matchId !== matchId))
  }

  function handleSubmit() {
    if (selections.length === 0 || isSubmitting) return
    if (isOverBudget) {
      toast(`Ikke nok credits. Du har ${displayCredits} credits tilbage.`, 'error')
      return
    }
    // Advar kun om ubrugte credits hvis de reelt går tabt — dvs. på blokkens
    // SIDSTE runde (eller spil uden blok-budget). Ruller resten videre til en
    // senere runde i blokken (creditsRollOver), er det en gyldig strategi at
    // gemme, og vi låser uden at spørge.
    if (displayCredits > 0 && !creditsRollOver) {
      setShowUnusedWarning(true)
      return
    }
    doSubmit()
  }

  async function doSubmit() {
    setShowUnusedWarning(false)
    if (selections.length === 0) return

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
    const res = await fetch(submitApiPath ?? `/api/rounds/${roundId}/submit-bets`, {
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

  const sorted = useMemo(
    () => [...matches].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at)),
    [matches]
  )

  // Pre-compute per-match data
  const matchData = useMemo(() => {
    return sorted.map((match) => {
      const matchResultBet = existingBets.find(
        (b) => b.match_id === match.id && b.bet_type === 'match_result'
      )
      const userExtraPicks: Record<string, string> = {}
      const userExtraBetData: Record<string, ExtraBetData> = {}
      for (const b of existingBets) {
        if (b.match_id === match.id && EXTRA_BET_TYPES.includes(b.bet_type as ExtraBetType)) {
          userExtraPicks[b.bet_type] = b.prediction
          userExtraBetData[b.bet_type] = {
            prediction: b.prediction,
            stake: b.stake,
            points_earned: b.points_earned,
            result: b.result,
            odds: (b as unknown as { odds?: number | null }).odds ?? null,
          }
        }
      }
      return {
        match,
        isFinished: match.status === 'finished',
        isLocked: !match.bet_open,
        isOpen: matchBettingOpen(match),
        rivalry: rivalryInfo[match.id],
        correctOutcome: getCorrectOutcome(match),
        userPrediction: (matchResultBet?.prediction as '1' | 'X' | '2') ?? null,
        userExtraPicks,
        userExtraBetData,
        matchResultBet,
      }
    })
  }, [sorted, existingBets, rivalryInfo, matchBettingOpen])

  // Build date-separated match list
  function renderMatchList(showInlineStake: boolean) {
    const elements: React.ReactNode[] = []
    let lastDateKey = ''
    for (const md of matchData) {
      const dateKey = md.match.kickoff_at ? matchdayKey(md.match.kickoff_at) : ''
      if (dateKey && dateKey !== lastDateKey) {
        const label = matchdayLabel(md.match.kickoff_at)
        elements.push(
          <div key={`sep-${dateKey}`} className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-[#e5e0d8]" />
            <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wide whitespace-nowrap">
              {label}
            </span>
            <div className="flex-1 h-px bg-[#e5e0d8]" />
          </div>
        )
        lastDateKey = dateKey
      }
      elements.push(
        <MatchCard
          key={md.match.id}
          match={md.match}
          sel={getSelection(md.match.id)}
          rivalry={md.rivalry}
          isFinished={md.isFinished}
          isLocked={md.isLocked}
          isOpen={md.isOpen}
          isReadOnly={isReadOnly}
          isEditing={editingMatchIds.has(md.match.id)}
          correctOutcome={md.correctOutcome}
          userPrediction={md.userPrediction}
          userExtraPicks={md.userExtraPicks}
          userExtraBetData={md.userExtraBetData}
          matchResultBet={md.matchResultBet}
          selectOutcome={selectOutcome}
          toggleExtra={toggleExtra}
          adjustExtraStake={adjustExtraStake}
          setExtraStake={setExtraStake}
          adjustStake={adjustStake}
          setStake={setStake}
          onStartEdit={startEditing}
          onCancelEdit={cancelEditing}
          showInlineStake={showInlineStake}
          distribution={betDistribution?.[md.match.id]}
        />
      )
    }
    return elements
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Engangs-guide til kuponen — kun når man faktisk kan spille */}
      {!isReadOnly && <BetSlipGuide />}

      {/* Ticker */}
      {tickerItems.length > 0 && <GameTicker items={tickerItems} />}

      {/* 📅 Kupon dækker flere dage (natkampe) — læg alle valg nu */}
      {!isReadOnly && spansMultipleDays && (
        <div className="w-full px-4 py-2.5 text-center" style={{ background: '#C9A84C' }}>
          <span className="font-condensed text-[13px] font-bold tracking-[0.02em]" style={{ color: '#1a3329' }}>
            📅 Denne kupon dækker BEGGE dage — også natkampene. Læg alle dine valg og brug dine credits nu;
            du kan ikke vende tilbage efter deadline.
          </span>
        </div>
      )}

      {/* 🍀 Losers Luck-banner — vises når spilleren er blandt de nederste */}
      {!isReadOnly && losersLuckActive && (
        <div className="w-full px-4 py-2.5 text-center" style={{ background: '#2C4A3E' }}>
          <span className="font-condensed text-[13px] font-bold tracking-[0.04em]" style={{ color: '#F2EDE4' }}>
            🍀 Losers Luck aktiv — du får <span style={{ color: '#C9A84C' }}>+20% på dine gevinster</span> i denne blok
          </span>
        </div>
      )}

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="w-full bg-[#c0392b]/15 border-b border-[#c0392b]/30 px-4 py-3 text-[var(--color-red-dark)] text-sm text-center">
          Denne runde er lukket for valg
        </div>
      )}

      {/* Header */}
      <div className="w-full bg-white border-b border-black/10">
        <div className="max-w-[960px] mx-auto px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[9px] font-bold tracking-widest text-[var(--color-warm-taupe)] uppercase">
                {gameName} · {round.name}
              </p>
              {blockInfo?.is_last_in_block && (
                <span className="font-condensed text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: 'rgba(184,150,62,0.15)', color: '#B8963E' }}>
                  Blokafslutning 🏆
                </span>
              )}
            </div>
            <h1 className="font-condensed text-[28px] md:text-[32px] font-extrabold text-[var(--color-dark-green)] leading-none">
              Afgiv dine valg
            </h1>
            {blockInfo && (
              <p className="font-condensed text-[11px] mt-0.5" style={{ color: '#9E9486' }}>
                Block {blockInfo.block_number} · {round.name}
              </p>
            )}
            <p className="text-[11px] text-[var(--color-warm-taupe)] mt-1">
              {totalMatches} kampe
            </p>
          </div>
          <div className="bg-[var(--color-cream)] border border-black/10 rounded-sm px-3 py-2 text-right shrink-0">
            <div className="text-[8px] font-bold tracking-widest text-[var(--color-warm-taupe)] uppercase">
              Deadline
            </div>
            <span className="font-condensed text-[20px] font-bold text-[var(--color-red-dark)] block leading-tight">
              {deadline.time}
            </span>
            <div className="text-[10px] text-[var(--color-warm-taupe)]">{deadline.date}</div>
          </div>
        </div>
      </div>

      {/* ═══ MOBILE LAYOUT (< md) ═══ */}
      <div className="md:hidden pb-[80px]">
        <div className="max-w-[680px] mx-auto px-4 py-4">
          {renderMatchList(true)}
        </div>

        {/* Mobile sticky footer */}
        {!isReadOnly && (
          <div className="fixed bottom-0 left-0 right-0 z-[90]">
            {/* Credits tilbage-nudge. I en blok (rollover) er det fair at gemme
                til næste runde → neutral besked. Ellers: ubrugt = spildt. */}
            {!isOverBudget && selections.length > 0 && displayCredits > 0 && (
              creditsRollOver ? (
                <button
                  type="button"
                  onClick={maxOut}
                  className="w-full bg-[#2C4A3E] text-[var(--color-cream)] font-condensed text-[12px] font-bold tracking-wider py-2 px-4 flex items-center justify-center gap-1.5 active:opacity-85"
                >
                  💡 {displayCredits} credits gemmes til blokkens næste runde · tryk for at bruge nu
                </button>
              ) : (
                <button
                  type="button"
                  onClick={maxOut}
                  className="w-full bg-gold text-[var(--color-dark-green)] font-condensed text-[12px] font-bold tracking-wider py-2 px-4 flex items-center justify-center gap-1.5 active:opacity-85"
                >
                  ⚡ {displayCredits} CREDITS UBRUGT — TRYK FOR AT MAXE UD
                </button>
              )
            )}
            <div
              className={`border-t-2 transition-colors ${
                isOverBudget ? 'bg-[#c0392b] border-[#c0392b]' : 'bg-[var(--color-dark-green)] border-[#1a3329]'
              }`}
            >
              <div className="max-w-[680px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">
                    {!isOverBudget && selections.length > 0 && displayCredits > 0
                      ? (creditsRollOver ? 'Tilbage til blokken' : 'Ubrugt')
                      : 'Dine credits'}
                  </span>
                  <span className={`font-condensed text-[20px] font-extrabold leading-none ${
                    isOverBudget ? 'text-white' : 'text-gold'
                  }`}>
                    {displayCredits === 0 && selections.length > 0 ? '✓ Maxet' : `${displayCredits} credits`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={selections.length === 0 || isSubmitting || isOverBudget}
                  className={`h-[42px] px-5 rounded-sm font-condensed text-[14px] font-bold tracking-wider transition-all ${
                    isOverBudget || selections.length === 0 || isSubmitting
                      ? 'bg-white/20 text-white/40 cursor-not-allowed'
                      : 'bg-gold text-[var(--color-dark-green)] hover:bg-[#d4aa55] hover:-translate-y-px'
                  }`}
                >
                  {isSubmitting
                    ? 'Gemmer...'
                    : `${selections.length} valg · ${totalPoints} credits · LÅS VALG →`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ DESKTOP LAYOUT (md+) ═══ */}
      <div className="hidden md:block">
        <div className="max-w-[960px] mx-auto grid grid-cols-[1fr_290px]">
          {/* Left — match cards */}
          <div className="py-3.5 px-5 pb-24 border-r border-black/10">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[9px] font-bold tracking-widest text-[var(--color-warm-taupe)] uppercase">
                Vælg udfald
              </span>
              <div className="flex items-center gap-2">
                <div className="w-[80px] h-0.5 bg-[#E8E0D4] rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-card-green)] rounded transition-all duration-300"
                    style={{ width: `${totalMatches > 0 ? (selections.length / totalMatches) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-condensed text-xs font-bold text-[var(--color-dark-green)]">
                  {selections.length} / {totalMatches}
                </span>
              </div>
            </div>
            {renderMatchList(false)}
          </div>

          {/* Right — sticky sidebar */}
          <div className="sticky top-[52px] h-[calc(100vh-52px)] flex flex-col bg-white overflow-hidden">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-black/10 shrink-0">
              <span className="font-condensed text-sm font-bold text-[var(--color-dark-green)] tracking-widest uppercase">
                Dine valg
              </span>
              <span className="font-condensed text-[22px] font-extrabold text-gold leading-none">
                {selections.length}
              </span>
            </div>

            {/* Credits bar */}
            {!isReadOnly && (
              <div className="px-3 py-2.5 border-b border-black/10 bg-[var(--color-cream)] shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold tracking-widest text-[var(--color-warm-taupe)] uppercase">
                    {!isOverBudget && selections.length > 0 && displayCredits > 0
                      ? (creditsRollOver ? 'Tilbage til blokken' : 'Ubrugte credits')
                      : 'Dine credits'}
                  </span>
                  <span className={`font-condensed text-[18px] font-extrabold leading-none ${
                    isOverBudget
                      ? 'text-[var(--color-red-dark)]'
                      : selections.length > 0 && displayCredits > 0
                        ? 'text-gold'
                        : 'text-[var(--color-dark-green)]'
                  }`}>
                    {displayCredits} credits
                  </span>
                </div>
                {/* Blok-kontekst: forklar at budgettet deles over blokkens 2 runder */}
                {blockSpentElsewhere > 0 && (
                  <p className="mt-1 text-[9px] text-[var(--color-warm-taupe)] leading-tight">
                    Blok-budget {blockBudget} · brugt i blokkens anden runde: {blockSpentElsewhere}
                  </p>
                )}
                {/* Maxe ud / læg-i-spil-knap når der er credits tilbage */}
                {!isOverBudget && selections.length > 0 && displayCredits > 0 && (
                  <button
                    type="button"
                    onClick={maxOut}
                    className={`mt-2 w-full h-[32px] rounded-sm font-condensed text-[12px] font-bold tracking-widest transition-colors ${
                      creditsRollOver
                        ? 'border border-[#2C4A3E] text-[var(--color-dark-green)] hover:bg-[#2C4A3E]/5'
                        : 'bg-gold text-[var(--color-dark-green)] hover:bg-[#d4aa55]'
                    }`}
                  >
                    {creditsRollOver ? `⚡ LÆG RESTEN I SPIL · ${displayCredits} CREDITS` : `⚡ MAXE UD · BRUG ${displayCredits} CREDITS`}
                  </button>
                )}
                {/* I en blok: forklar at resten gemmes til næste runde */}
                {creditsRollOver && !isOverBudget && selections.length > 0 && displayCredits > 0 && (
                  <p className="mt-1.5 text-center text-[9px] text-[var(--color-warm-taupe)] leading-tight">
                    Ellers gemmes de {displayCredits} til blokkens næste runde.
                  </p>
                )}
                {selections.length > 0 && displayCredits === 0 && (
                  <p className="mt-1.5 text-center text-[10px] font-bold tracking-wider text-gold uppercase">
                    ✓ Alle credits i spil
                  </p>
                )}
              </div>
            )}

            {/* Selections list with stake input */}
            <div className="flex-1 overflow-y-auto py-1.5 min-h-0">
              {selections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2 text-[var(--color-warm-taupe)] text-center px-5">
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
                      {/* Match name + outcome + remove */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[11px] font-semibold flex-1 truncate">
                          {entry.match.home_team} vs {entry.match.away_team}
                        </span>
                        <span className="font-condensed text-[13px] font-bold text-[#2C4A3E] bg-[var(--color-card-green)]/10 rounded px-1.5">
                          {entry.outcome}
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => removeSelection(entry.matchId)}
                            className="text-[11px] text-[var(--color-warm-taupe)] opacity-50 hover:opacity-100 hover:text-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {/* Stake input */}
                      {!isReadOnly ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustStake(entry.matchId, -50)}
                            className="w-6 h-6 border border-black/10 rounded bg-[var(--color-cream)] text-[var(--color-dark-green)] font-bold text-sm flex items-center justify-center"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={10}
                            value={entry.points}
                            onChange={(e) =>
                              setStake(entry.matchId, Math.max(10, parseInt(e.target.value) || 10))
                            }
                            className="flex-1 text-center font-condensed text-[15px] font-bold text-[var(--color-dark-green)] border border-black/10 rounded bg-[var(--color-cream)] h-6"
                          />
                          <span className="text-[10px] text-[var(--color-warm-taupe)] font-semibold">credits</span>
                          <button
                            type="button"
                            onClick={() => adjustStake(entry.matchId, 50)}
                            className="w-6 h-6 border border-black/10 rounded bg-[var(--color-cream)] text-[var(--color-dark-green)] font-bold text-sm flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="font-condensed text-[15px] font-bold text-[var(--color-dark-green)]">
                          {entry.points} credits
                        </span>
                      )}
                    </div>
                    {/* Extra bets in sidebar */}
                    {entry.extraBets.length > 0 && (
                      <div className="mx-3 mb-2 border border-black/[0.08] rounded-md overflow-hidden">
                        {entry.extraBets.map((eb, i) => (
                          <div
                            key={eb.type}
                            className={`flex items-center gap-2 px-2.5 py-1.5 ${
                              i > 0 ? 'border-t border-black/[0.07]' : ''
                            } bg-[var(--color-cream)]/60`}
                          >
                            <span className="text-[9px] font-semibold text-[var(--color-warm-taupe)] w-[70px] shrink-0 leading-tight">
                              {BET_TYPE_LABELS[eb.type] ?? eb.type}
                            </span>
                            <span className="font-condensed text-[12px] font-bold text-[#2C4A3E] bg-[var(--color-card-green)]/10 rounded px-1.5 shrink-0">
                              {getExtraBetLabel(eb.type, eb.prediction)}
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                type="button"
                                onClick={() => adjustExtraStake(entry.matchId, eb.type as ExtraBetType, -50)}
                                className="w-5 h-5 border border-black/10 rounded bg-[var(--color-cream)] text-[var(--color-dark-green)] font-bold text-xs flex items-center justify-center"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={10}
                                value={eb.points}
                                onChange={(e) => setExtraStake(entry.matchId, eb.type as ExtraBetType, parseInt(e.target.value) || 10)}
                                className="w-12 text-center font-condensed text-[12px] font-bold text-[var(--color-dark-green)] border border-black/10 rounded bg-[var(--color-cream)] h-5"
                              />
                              <span className="text-[9px] text-[var(--color-warm-taupe)] font-semibold">credits</span>
                              <button
                                type="button"
                                onClick={() => adjustExtraStake(entry.matchId, eb.type as ExtraBetType, 50)}
                                className="w-5 h-5 border border-black/10 rounded bg-[var(--color-cream)] text-[var(--color-dark-green)] font-bold text-xs flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Sidebar footer */}
            <div className="border-t-2 border-black/10 px-3 py-2.5 bg-white shrink-0">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-[var(--color-warm-taupe)] font-semibold">Antal valg</span>
                <span className="font-condensed text-base font-bold text-[var(--color-dark-green)]">
                  {selections.length}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] text-[var(--color-warm-taupe)] font-semibold">Samlet indsats</span>
                <span className="font-condensed text-base font-bold text-gold">
                  {totalPoints} credits
                </span>
              </div>
              <p
                className="text-[9px] text-center mb-2 leading-relaxed"
                style={{ color: selections.length === totalMatches ? '#B8963E' : '#7a7060' }}
              >
                {selections.length === totalMatches
                  ? '⭐ Full house! Du får +25 point bonus.'
                  : '🔒 Dine point-faktorer afsløres efter deadline.'}
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={selections.length === 0 || isSubmitting || isReadOnly || isOverBudget}
                className={`w-full h-[42px] rounded-sm font-condensed text-[15px] font-bold tracking-widest transition-all ${
                  isOverBudget
                    ? 'bg-[#c0392b] text-white cursor-not-allowed'
                    : 'bg-gold text-[var(--color-dark-green)] disabled:bg-[#E8E0D4] disabled:text-[var(--color-warm-taupe)] hover:bg-[#d4aa55] hover:-translate-y-px disabled:cursor-not-allowed disabled:transform-none'
                }`}
              >
                {isSubmitting ? 'Gemmer...' : 'LÅS DINE VALG'}
              </button>
              {selections.length > 0 && selections.length < totalMatches && (
                <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded border border-dashed border-gold/40 bg-gold/[0.07]">
                  <span className="text-[9px] text-gold font-semibold">
                    ⭐ Vælg alle {totalMatches} kampe og få +25 point bonus!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ubrugte credits — bekræft før lås */}
      {showUnusedWarning && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6"
          onClick={() => setShowUnusedWarning(false)}
        >
          <div
            className="bg-white rounded-sm border border-black/10 max-w-sm w-full p-5 shadow-xl"
            style={{ animation: 'fadeSlideIn 0.2s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-condensed text-[22px] font-extrabold text-[var(--color-dark-green)] leading-tight mb-1.5">
              Du har {displayCredits} credits tilbage
            </h3>
            <p className="text-[13px] text-[var(--color-warm-taupe)] leading-relaxed mb-4">
              {creditsRollOver ? (
                <>I en blok deles dine credits over to runder. Du kan <strong>gemme</strong> resten
                til blokkens næste runde, eller lægge dem i spil nu.</>
              ) : (
                <>Ubrugte credits giver <strong>ingen point</strong>. Vil du fordele dem på dine valg,
                så du får mest muligt ud af dine odds?</>
              )}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  maxOut()
                  setShowUnusedWarning(false)
                }}
                className="w-full h-[44px] rounded-sm bg-gold text-[var(--color-dark-green)] font-condensed text-[14px] font-bold tracking-widest hover:bg-[#d4aa55] transition-colors"
              >
                {creditsRollOver ? '⚡ LÆG RESTEN I SPIL NU' : '⚡ FORDEL RESTEN AUTOMATISK'}
              </button>
              <button
                type="button"
                onClick={doSubmit}
                disabled={isSubmitting}
                className="w-full h-[44px] rounded-sm bg-[var(--color-dark-green)] text-white font-condensed text-[14px] font-bold tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'GEMMER…' : creditsRollOver ? 'GEM TIL NÆSTE RUNDE' : 'LÅS VALG ALLIGEVEL'}
              </button>
              <button
                type="button"
                onClick={() => setShowUnusedWarning(false)}
                className="w-full h-[38px] text-[var(--color-warm-taupe)] font-condensed text-[13px] font-bold tracking-wider hover:text-[var(--color-dark-green)] transition-colors"
              >
                TILBAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
