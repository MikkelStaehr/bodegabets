'use client'

import Link from 'next/link'
import { useLiveMatchesForUser } from '@/hooks/useLiveMatches'
import { LiveMatchesTicker } from '@/components/LiveMatchesTicker'

export default function LiveMatchesDashboard() {
  const { items, lastUpdate } = useLiveMatchesForUser(true)

  if (items.length === 0) return null

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h2 className="font-condensed font-700 text-ink text-xl uppercase tracking-wide">
          Live lige nu
        </h2>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={`${item.gameId}-${item.roundId}`}
            href={`/games/${item.gameId}/rounds/${item.roundId}`}
            className="block rounded-xl overflow-hidden hover:ring-2 hover:ring-forest/30 transition-all"
          >
            <LiveMatchesTicker
              matches={item.matches}
              summary={item.summary}
              lastUpdate={lastUpdate}
              headerTitle={
                <span className="text-forest font-condensed">
                  {item.gameName} · {item.roundName}
                </span>
              }
              headerRight={
                <span className="text-[10px] uppercase text-text-warm font-condensed">
                  {item.summary.live > 0 && `${item.summary.live} live`}
                  {item.summary.live > 0 && item.summary.halftime > 0 && ' · '}
                  {item.summary.halftime > 0 && `${item.summary.halftime} HT`}
                  {item.summary.finished > 0 &&
                    (item.summary.live > 0 || item.summary.halftime > 0 ? ' · ' : '') +
                      `${item.summary.finished} FT`}
                </span>
              }
              maxMatches={5}
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
