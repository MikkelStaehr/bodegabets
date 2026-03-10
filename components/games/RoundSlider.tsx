'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Round } from '@/types'

type ActiveRoundResult = {
  id: number
  name: string
  round_status: 'upcoming' | 'open' | 'active' | 'finished' | null
  betting_closes_at: string | null
  first_kickoff?: string | null
  next_kickoff?: string | null
}

interface RoundSliderProps {
  rounds: Round[]
  activeRound: ActiveRoundResult | null
  betsCount: number
  gameId: number
  matchCountByRound?: Record<number, number>
  prevRoundDate?: string | null
  nextRoundDate?: string | null
}

function formatCardDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return (
    d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
  )
}

function getCardType(
  round: Round,
  activeRound: ActiveRoundResult | null,
  betsCount: number
): 'finished' | 'open' | 'active' | 'upcoming' {
  if (round.status === 'finished') return 'finished'
  const isActive = activeRound && activeRound.id === round.id
  if (!isActive) return 'upcoming'
  const status = activeRound.round_status
  if (status === 'upcoming') return 'upcoming'
  if ((status === 'open' || status === 'active') && betsCount === 0) return 'open'
  if ((status === 'open' || status === 'active') && betsCount > 0) return 'active'
  return 'upcoming'
}

export default function RoundSlider({
  rounds,
  activeRound,
  betsCount,
  gameId,
  matchCountByRound = {},
  prevRoundDate = null,
  nextRoundDate = null,
}: RoundSliderProps) {
  const activeCardRef = useRef<HTMLDivElement>(null)

  const sortedRounds = [...rounds].sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] ?? '0', 10)
    const numB = parseInt(b.name.match(/\d+/)?.[0] ?? '0', 10)
    return numA - numB
  })
  const activeIndex = Math.max(
    0,
    sortedRounds.findIndex((r) => r.id === activeRound?.id)
  )
  const visibleRounds = [
    sortedRounds[activeIndex - 1] ?? null,
    sortedRounds[activeIndex] ?? null,
    sortedRounds[activeIndex + 1] ?? null,
  ].filter((r): r is Round => r != null)

  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [])

  if (sortedRounds.length === 0 || visibleRounds.length === 0) return null

  function getDateForRound(round: Round, position: 'prev' | 'active' | 'next'): string | null {
    if (position === 'active') return formatCardDate(activeRound?.first_kickoff ?? activeRound?.betting_closes_at ?? null)
    if (position === 'prev') return formatCardDate(prevRoundDate ?? null)
    return formatCardDate(nextRoundDate ?? null)
  }

  const deadlineFormatted = formatDeadline(activeRound?.next_kickoff ?? activeRound?.betting_closes_at ?? null)

  return (
    <div className="overflow-hidden -mx-4 md:mx-0">
      <div
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pl-[calc(50%-80px)] pr-[calc(50%-80px)] md:pl-[calc(50%-90px)] md:pr-[calc(50%-90px)]"
        style={{ touchAction: 'pan-x' }}
      >
        {visibleRounds.map((round, i) => {
          const isActive = round.id === activeRound?.id
          const position: 'prev' | 'active' | 'next' = isActive
            ? 'active'
            : round.id === rounds[activeIndex - 1]?.id
              ? 'prev'
              : 'next'
          const cardType = getCardType(round, activeRound, betsCount)
          const matchCount = matchCountByRound[round.id] ?? 0
          const cardDate = getDateForRound(round, position)

          if (cardType === 'finished') {
            return (
              <div
                key={round.id}
                className="shrink-0 w-[160px] md:w-[180px] rounded-xl border border-[#d4cec4] bg-[#e8e3d8] p-4 opacity-60 scale-[0.88] snap-center [touch-action:pan-x]"
              >
                <p className="font-['Barlow_Condensed'] text-sm font-bold text-[#1a3329] uppercase">
                  {round.name}
                </p>
                {cardDate && (
                  <p className="mt-1 text-[11px] text-[#7a7060]">{cardDate}</p>
                )}
                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-[#7a7060]/20 text-[#7a7060] uppercase">
                  Afsluttet
                </span>
                <Link
                  href={`/games/${gameId}/rounds/${round.id}`}
                  className="text-xs text-[#7a7060] hover:text-[#3a3530] transition-colors mt-3 block"
                >
                  Se kampe & resultater →
                </Link>
              </div>
            )
          }

          if (cardType === 'open') {
            return (
              <div
                key={round.id}
                ref={activeCardRef}
                className="shrink-0 w-[160px] md:w-[180px] rounded-xl border-2 border-[#B8963E] bg-[#1e2a1e] p-4 scale-[1.05] pulse-ring snap-center [touch-action:pan-x]"
              >
                <p className="font-['Barlow_Condensed'] text-sm font-bold text-[#F2EDE4] uppercase">
                  {round.name}
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-[#B8963E]/20 text-[#B8963E] uppercase">
                  Afgiv bets
                </span>
                {deadlineFormatted && (
                  <p className="mt-2 text-[11px] text-[#F2EDE4]/70">Lukker {deadlineFormatted}</p>
                )}
                <Link
                  href={`/games/${gameId}/rounds/${round.id}`}
                  className="mt-4 block w-full py-3 text-center font-['Barlow_Condensed'] text-sm font-bold text-[#1e2a1e] bg-[#F2EDE4] rounded-lg hover:bg-[#e8e3d8] transition-colors uppercase tracking-wide"
                >
                  Afgiv bets ›
                </Link>
              </div>
            )
          }

          if (cardType === 'active') {
            const totalMatches = matchCountByRound[round.id] ?? 0
            const subtext =
              totalMatches > 0
                ? `${betsCount}/${totalMatches} bets` + (deadlineFormatted ? ` · Lukker ${deadlineFormatted}` : '')
                : deadlineFormatted
                  ? `Lukker ${deadlineFormatted}`
                  : null
            return (
              <div
                key={round.id}
                ref={activeCardRef}
                className="shrink-0 w-[160px] md:w-[180px] rounded-xl border-2 border-[#B8963E] bg-[#1e2a1e] p-4 scale-[1.0] snap-center [touch-action:pan-x]"
              >
                <p className="font-['Barlow_Condensed'] text-sm font-bold text-[#F2EDE4] uppercase">
                  {round.name}
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-[#B8963E]/20 text-[#B8963E] uppercase">
                  Aktiv
                </span>
                {subtext && (
                  <p className="mt-2 text-[11px] text-[#F2EDE4]/70">{subtext}</p>
                )}
                <Link
                  href={`/games/${gameId}/rounds/${round.id}`}
                  className="mt-4 block w-full py-3 text-center font-['Barlow_Condensed'] text-sm font-bold text-[#1e2a1e] bg-[#F2EDE4] rounded-lg hover:bg-[#e8e3d8] transition-colors uppercase tracking-wide"
                >
                  Se / ændr bets ›
                </Link>
              </div>
            )
          }

          return (
            <div
              key={round.id}
              className="shrink-0 w-[160px] md:w-[180px] rounded-xl border border-[#ddd8ce] bg-[#eeeae0] p-4 opacity-60 scale-[0.88] snap-center [touch-action:pan-x]"
            >
              <p className="font-['Barlow_Condensed'] text-sm font-bold text-[#1a3329] uppercase">
                {round.name}
              </p>
              {cardDate && (
                <p className="mt-1 text-[11px] text-[#7a7060]">{cardDate}</p>
              )}
              <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-[#7a7060]/20 text-[#7a7060] uppercase">
                Kommende
              </span>
              <Link
                href={`/games/${gameId}/rounds/${round.id}`}
                className="text-xs text-[#7a7060] hover:text-[#3a3530] transition-colors mt-3 block"
              >
                Se kampe →
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
