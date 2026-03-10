'use client'

import Link from 'next/link'
import { useLiveMatches } from '@/hooks/useLiveMatches'
import { LiveMatchesTicker } from '@/components/LiveMatchesTicker'

type Props = {
  roundId: number
  gameId?: number
  gameName?: string
  roundName?: string
  compact?: boolean
}

export default function LiveMatches({ roundId, gameId, gameName, roundName, compact }: Props) {
  const { matches, summary, lastUpdate } = useLiveMatches(roundId, true)

  if (summary.total === 0) return null

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {summary.live > 0 && <span className="text-red-600 font-condensed font-600">{summary.live} live</span>}
        {summary.halftime > 0 && <span className="text-amber-700 font-condensed">{summary.halftime} HT</span>}
        {summary.finished > 0 && <span className="text-gray-600 font-condensed">{summary.finished} FT</span>}
      </div>
    )
  }

  const headerAction =
    gameId && roundName ? (
      <Link
        href={`/games/${gameId}/rounds/${roundId}`}
        className="font-condensed text-[10px] uppercase tracking-wider text-forest hover:underline"
      >
        Se runde
      </Link>
    ) : undefined

  return (
    <LiveMatchesTicker
      matches={matches}
      summary={summary}
      lastUpdate={lastUpdate}
      headerAction={headerAction}
    />
  )
}
