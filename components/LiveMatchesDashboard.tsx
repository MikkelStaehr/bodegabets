'use client'

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
        {items.map((item) => {
          const summary = {
            live: item.matches.filter((m) => m.status === 'live').length,
            halftime: item.matches.filter((m) => m.status === 'halftime').length,
            finished: item.matches.filter((m) => m.status === 'finished').length,
            scheduled: item.matches.filter((m) => m.status === 'scheduled').length,
            total: item.matches.length,
          }
          return (
            <div
              key={item.leagueId}
              className="block rounded-xl overflow-hidden"
            >
              <LiveMatchesTicker
                matches={item.matches}
                summary={summary}
                lastUpdate={lastUpdate}
                headerTitle={
                  <span className="text-forest font-condensed">
                    {item.leagueName}
                  </span>
                }
                headerRight={
                  <span className="text-[10px] uppercase text-text-warm font-condensed">
                    {summary.live > 0 && `${summary.live} live`}
                    {summary.live > 0 && summary.halftime > 0 && ' · '}
                    {summary.halftime > 0 && `${summary.halftime} HT`}
                    {summary.finished > 0 &&
                      (summary.live > 0 || summary.halftime > 0 ? ' · ' : '') +
                        `${summary.finished} FT`}
                  </span>
                }
                maxMatches={5}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
