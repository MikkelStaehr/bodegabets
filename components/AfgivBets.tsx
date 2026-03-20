'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Match, Bet } from '@/types'
import { BET_TYPE_LABELS, PREDICTION_LABELS } from '@/lib/betTypes'
import { isBetCorrect } from '@/lib/betUtils'
import { useToast } from '@/components/ui/Toast'
import GameTicker from '@/components/GameTicker'

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
}

function initSelections(_matches: MatchWithOptions[], _existing: Bet[]): BetEntry[] {
  // Existing bets are already paid — don't load them into selections.
  // Only new/changed bets appear in selections and count towards credits.
  return []
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
  toggleExtra: (matchId: number, key: ExtraBetType, value: string) => void
  adjustExtraStake: (matchId: number, type: ExtraBetType, delta: number) => void
  setExtraStake: (matchId: number, type: ExtraBetType, val: number) => void
}) {
  const [open, setOpen] = useState(sel.extraBets.length > 0)

  return (
    <div className={`border-t ${isRivalry ? 'border-[#B8963E]/20' : 'border-black/[0.06]'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left"
      >
        <span className={`text-[9px] font-bold tracking-widest uppercase flex-1 ${isRivalry ? 'text-[#B8963E]/70' : 'text-[#7a7060]'}`}>
          + Ekstra valg
        </span>
        <span className={`text-[9px] transition-transform ${isRivalry ? 'text-[#B8963E]/50' : 'text-[#7a7060]'} ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {open && (
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
                        onClick={() => toggleExtra(matchId, row.key, opt.value)}
                        className={`flex-1 py-1 border-[1.5px] rounded text-[10px] font-semibold transition-all ${cls}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                {pick && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => adjustExtraStake(matchId, row.key, -50)}
                      className={`w-6 h-6 border rounded font-bold text-sm flex items-center justify-center ${
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
                      value={sel.extraBets.find((eb) => eb.type === row.key)?.points ?? 50}
                      onChange={(e) => setExtraStake(matchId, row.key, parseInt(e.target.value) || 10)}
                      className={`w-14 text-center font-condensed text-[13px] font-bold border rounded h-6 ${
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
                      onClick={() => adjustExtraStake(matchId, row.key, 50)}
                      className={`w-6 h-6 border rounded font-bold text-sm flex items-center justify-center ${
                        isRivalry
                          ? 'border-[#B8963E]/30 bg-[#2C4A3E] text-[#F2EDE4]'
                          : 'border-black/10 bg-[#F2EDE4] text-[#1a3329]'
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

/* ─── Read-only Extra Bets for Finished Matches ─── */
function FinishedExtraBets({
  match,
  userExtraPicks,
}: {
  match: Match
  userExtraPicks: Record<string, string>
}) {
  if (Object.keys(userExtraPicks).length === 0) return null
  return (
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
  matchResultBet: Bet | undefined
  selectOutcome: (matchId: number, outcome: '1' | 'X' | '2') => void
  toggleExtra: (matchId: number, key: ExtraBetType, value: string) => void
  adjustExtraStake: (matchId: number, type: ExtraBetType, delta: number) => void
  setExtraStake: (matchId: number, type: ExtraBetType, val: number) => void
  adjustStake: (matchId: number, delta: number) => void
  setStake: (matchId: number, val: number) => void
  onStartEdit: (matchId: number) => void
  onCancelEdit: (matchId: number) => void
  showInlineStake: boolean
}) {
  const isRivalry = !!rivalry
  const hasExistingBet = isOpen && !!matchResultBet
  const displayOutcome = isFinished ? userPrediction : (sel?.outcome ?? userPrediction)

  const cardBg = isRivalry ? 'bg-[#1a3329]' : 'bg-white'
  const hasSelection = !!sel || (!isFinished && !!userPrediction)
  const cardBorder = isRivalry
    ? 'border-[#B8963E]'
    : hasSelection
      ? 'border-[#2C4A3E] shadow-[0_0_0_1px_#2C4A3E]'
      : 'border-black/10'
  const textPrimary = isRivalry ? 'text-[#F2EDE4]' : 'text-[#1a3329]'
  const textSecondary = isRivalry ? 'text-[#F2EDE4]/50' : 'text-[#7a7060]'
  const scoreSep = isRivalry ? 'text-[#F2EDE4]/60' : 'text-[#7a7060]'

  return (
    <div className={`${cardBg} border rounded-lg mb-2 overflow-hidden transition-all ${cardBorder}`}>
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
                  ? isRivalry ? 'text-[#1a3329]' : 'text-white'
                  : isRivalry ? 'text-[#F2EDE4]/70' : 'text-[#7a7060]'
              }`}>
                {o}
              </span>
              <span className={`text-[8px] font-medium ${
                textLight
                  ? isRivalry ? 'text-[#1a3329]/60' : 'text-white/60'
                  : isRivalry ? 'text-[#F2EDE4]/40' : 'text-[#7a7060]'
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
        <div className={`px-3 pb-2 ${isRivalry ? 'border-t border-[#B8963E]/20' : ''}`}>
          {EXTRA_BET_ROWS
            .filter((row) => userExtraPicks[row.key])
            .map((row) => (
              <div key={row.key} className="mb-1">
                <span className={`text-[9px] font-bold tracking-wider uppercase mb-0.5 block ${isRivalry ? 'text-[#B8963E]/70' : 'text-[#7a7060]'}`}>
                  {row.label}
                </span>
                <div className="flex gap-1">
                  {row.opts.map((opt) => {
                    const isUserPick = userExtraPicks[row.key] === opt.value
                    const cls = isUserPick
                      ? isRivalry
                        ? 'bg-[#B8963E] border-[#B8963E] text-[#1a3329]'
                        : 'bg-[#2C4A3E] border-[#2C4A3E] text-white'
                      : isRivalry
                        ? 'bg-[#2C4A3E] border-[#B8963E]/20 text-[#F2EDE4]/40'
                        : 'bg-white border-black/10 text-[#7a7060]/40'
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
      {isFinished && <FinishedExtraBets match={match} userExtraPicks={userExtraPicks} />}

      {/* Inline stake — mobile only (controlled via showInlineStake) */}
      {showInlineStake && isOpen && sel && (
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

      {/* Open match with existing bet: show stake + Ændre/Fortryd button */}
      {hasExistingBet && (
        <div className={`flex items-center justify-between px-3 py-1.5 ${isRivalry ? 'border-t border-[#B8963E]/20' : 'border-t border-black/[0.06]'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isRivalry ? 'text-[#B8963E]/70' : 'text-[#7a7060]'}`}>
            Dit valg
          </span>
          <div className="flex items-center gap-2">
            <span className={`font-condensed text-[14px] font-bold ${isRivalry ? 'text-[#F2EDE4]/70' : 'text-[#7a7060]'}`}>
              {matchResultBet.stake} pt
            </span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => isEditing ? onCancelEdit(match.id) : onStartEdit(match.id)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                  isEditing
                    ? isRivalry
                      ? 'text-[#F2EDE4]/70 hover:text-[#F2EDE4] border border-[#B8963E]/30'
                      : 'text-[#c0392b] hover:text-[#c0392b]/80 border border-[#c0392b]/30'
                    : isRivalry
                      ? 'text-[#B8963E] hover:text-[#B8963E]/80 border border-[#B8963E]/30'
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
}: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [selections, setSelections] = useState<BetEntry[]>(() => initSelections(matches, existingBets))
  const [editingMatchIds, setEditingMatchIds] = useState<Set<number>>(new Set())
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
    if (s.isReplacement) {
      const oldStake = existingBets.find(
        (b) => b.match_id === s.matchId && b.bet_type === 'match_result'
      )?.stake ?? 0
      return sum + Math.max(0, s.points - oldStake)
    }
    const main = s.points
    const extra = s.extraBets.reduce((es, eb) => es + eb.points, 0)
    return sum + main + extra
  }, 0)
  const displayCredits = userPoints - totalPoints
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
            prev.map((s) =>
              s.matchId === matchId
                ? { ...s, outcome: existingBet.prediction as '1' | 'X' | '2' }
                : s
            )
          )
        } else {
          setSelections((prev) => prev.filter((s) => s.matchId !== matchId))
        }
        return
      }
      setSelections((prev) =>
        prev.map((s) => (s.matchId === matchId ? { ...s, outcome } : s))
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

  const toggleExtra = (matchId: number, key: ExtraBetType, value: string) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.matchId !== matchId) return s
        const existing = s.extraBets.find((eb) => eb.type === key)
        let next: ExtraBet[]
        if (existing?.prediction === value) {
          next = s.extraBets.filter((eb) => eb.type !== key)
        } else if (existing) {
          next = s.extraBets.map((eb) => (eb.type === key ? { ...eb, prediction: value } : eb))
        } else {
          next = [...s.extraBets, { type: key, prediction: value, points: 50 }]
        }
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

  async function handleSubmit() {
    if (selections.length === 0) return
    if (totalPoints > userPoints) {
      toast(`Ikke nok credits. Du har ${userPoints} pt.`, 'error')
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
      for (const b of existingBets) {
        if (b.match_id === match.id && EXTRA_BET_TYPES.includes(b.bet_type as ExtraBetType)) {
          userExtraPicks[b.bet_type] = b.prediction
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
        matchResultBet,
      }
    })
  }, [sorted, existingBets, rivalryInfo, matchBettingOpen])

  // Build date-separated match list
  function renderMatchList(showInlineStake: boolean) {
    const elements: React.ReactNode[] = []
    let lastDateKey = ''
    for (const md of matchData) {
      const dateKey = md.match.kickoff_at
        ? new Date(md.match.kickoff_at).toLocaleDateString('da-DK', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            timeZone: 'UTC',
          })
        : ''
      if (dateKey && dateKey !== lastDateKey) {
        const label = new Date(md.match.kickoff_at).toLocaleDateString('da-DK', {
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
        />
      )
    }
    return elements
  }

  return (
    <div className="min-h-screen bg-[#F2EDE4]">
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
        <div className="max-w-[960px] mx-auto px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold tracking-widest text-[#7a7060] uppercase mb-1">
              {gameName} · {round.name}
            </p>
            <h1 className="font-condensed text-[28px] md:text-[32px] font-extrabold text-[#1a3329] leading-none">
              Afgiv dine valg
            </h1>
            <p className="text-[11px] text-[#7a7060] mt-1">
              {totalMatches} kampe
            </p>
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

      {/* ═══ MOBILE LAYOUT (< md) ═══ */}
      <div className="md:hidden pb-[80px]">
        <div className="max-w-[680px] mx-auto px-4 py-4">
          {renderMatchList(true)}
        </div>

        {/* Mobile sticky footer */}
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

      {/* ═══ DESKTOP LAYOUT (md+) ═══ */}
      <div className="hidden md:block">
        <div className="max-w-[960px] mx-auto grid grid-cols-[1fr_290px]">
          {/* Left — match cards */}
          <div className="py-3.5 px-5 pb-24 border-r border-black/10">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[9px] font-bold tracking-widest text-[#7a7060] uppercase">
                Vælg udfald
              </span>
              <div className="flex items-center gap-2">
                <div className="w-[80px] h-0.5 bg-[#E8E0D4] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#2C4A3E] rounded transition-all duration-300"
                    style={{ width: `${totalMatches > 0 ? (selections.length / totalMatches) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-condensed text-xs font-bold text-[#1a3329]">
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
              <span className="font-condensed text-sm font-bold text-[#1a3329] tracking-widest uppercase">
                Dine valg
              </span>
              <span className="font-condensed text-[22px] font-extrabold text-[#B8963E] leading-none">
                {selections.length}
              </span>
            </div>

            {/* Credits bar */}
            {!isReadOnly && (
              <div className="px-3 py-2.5 border-b border-black/10 bg-[#F2EDE4] shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold tracking-widest text-[#7a7060] uppercase">
                    Dine credits
                  </span>
                  <span className={`font-condensed text-[18px] font-extrabold leading-none ${
                    isOverBudget ? 'text-[#c0392b]' : 'text-[#1a3329]'
                  }`}>
                    {displayCredits} pt
                  </span>
                </div>
              </div>
            )}

            {/* Selections list with stake input */}
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
                      {/* Match name + outcome + remove */}
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
                      {/* Stake input */}
                      {!isReadOnly ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustStake(entry.matchId, -50)}
                            className="w-6 h-6 border border-black/10 rounded bg-[#F2EDE4] text-[#1a3329] font-bold text-sm flex items-center justify-center"
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
                            className="flex-1 text-center font-condensed text-[15px] font-bold text-[#1a3329] border border-black/10 rounded bg-[#F2EDE4] h-6"
                          />
                          <span className="text-[10px] text-[#7a7060] font-semibold">pt</span>
                          <button
                            type="button"
                            onClick={() => adjustStake(entry.matchId, 50)}
                            className="w-6 h-6 border border-black/10 rounded bg-[#F2EDE4] text-[#1a3329] font-bold text-sm flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="font-condensed text-[15px] font-bold text-[#1a3329]">
                          {entry.points} pt
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
                            } bg-[#F2EDE4]/60`}
                          >
                            <span className="text-[9px] font-semibold text-[#7a7060] w-[70px] shrink-0 leading-tight">
                              {BET_TYPE_LABELS[eb.type] ?? eb.type}
                            </span>
                            <span className="font-condensed text-[12px] font-bold text-[#2C4A3E] bg-[#2C4A3E]/10 rounded px-1.5 shrink-0">
                              {getExtraBetLabel(eb.type, eb.prediction)}
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                type="button"
                                onClick={() => adjustExtraStake(entry.matchId, eb.type as ExtraBetType, -50)}
                                className="w-5 h-5 border border-black/10 rounded bg-[#F2EDE4] text-[#1a3329] font-bold text-xs flex items-center justify-center"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={10}
                                value={eb.points}
                                onChange={(e) => setExtraStake(entry.matchId, eb.type as ExtraBetType, parseInt(e.target.value) || 10)}
                                className="w-12 text-center font-condensed text-[12px] font-bold text-[#1a3329] border border-black/10 rounded bg-[#F2EDE4] h-5"
                              />
                              <span className="text-[9px] text-[#7a7060] font-semibold">pt</span>
                              <button
                                type="button"
                                onClick={() => adjustExtraStake(entry.matchId, eb.type as ExtraBetType, 50)}
                                className="w-5 h-5 border border-black/10 rounded bg-[#F2EDE4] text-[#1a3329] font-bold text-xs flex items-center justify-center"
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
                disabled={selections.length === 0 || isSubmitting || isReadOnly || isOverBudget}
                className={`w-full h-[42px] rounded-lg font-condensed text-[15px] font-bold tracking-widest transition-all ${
                  isOverBudget
                    ? 'bg-[#c0392b] text-white cursor-not-allowed'
                    : 'bg-[#B8963E] text-[#1a3329] disabled:bg-[#E8E0D4] disabled:text-[#7a7060] hover:bg-[#d4aa55] hover:-translate-y-px disabled:cursor-not-allowed disabled:transform-none'
                }`}
              >
                {isSubmitting ? 'Gemmer...' : 'LÅS DINE VALG'}
              </button>
              {selections.length > 0 && selections.length < totalMatches && (
                <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded border border-dashed border-[#B8963E]/40 bg-[#B8963E]/[0.07]">
                  <span className="text-[9px] text-[#B8963E] font-semibold">
                    ⭐ Vælg alle {totalMatches} kampe og få +25 pt bonus!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
