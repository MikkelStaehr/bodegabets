'use client'

import { useEffect, useState, useMemo } from 'react'
import JoinGameCard from './JoinGameCard'
import type { SportType } from './DashboardContent'

type RecentMatch = {
  id: number
  home_score: number | null
  away_score: number | null
  kickoff_at: string
  status: string
  result: string | null
  home_team: { name: string; shortname: string | null; logo_url: string | null } | null
  away_team: { name: string; shortname: string | null; logo_url: string | null } | null
}

type ScheduleMatch = {
  id: number
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team: { name: string; shortname: string | null; logo_url: string | null } | null
  away_team: { name: string; shortname: string | null; logo_url: string | null } | null
}

function teamShort(team: { name: string; shortname: string | null } | null): string {
  if (!team) return '?'
  return team.shortname || team.name.slice(0, 3).toUpperCase()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('da-DK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') return <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full uppercase">Live</span>
  if (status === 'halftime') return <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full uppercase">HT</span>
  return null
}

export default function DashboardSidebar({
  recentMatches,
  nextRoundDate,
  sportFilter,
}: {
  recentMatches: RecentMatch[]
  nextRoundDate: string | null
  sportFilter: 'all' | SportType
}) {
  const [todayMatches, setTodayMatches] = useState<ScheduleMatch[]>([])
  const [yesterdayMatches, setYesterdayMatches] = useState<ScheduleMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/todays-matches')
      .then((r) => r.json())
      .then((data) => {
        if (data.today) setTodayMatches(data.today)
        if (data.yesterday) setYesterdayMatches(data.yesterday)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const groupedByDate = useMemo(() => {
    const groups: Record<string, RecentMatch[]> = {}
    for (const match of recentMatches) {
      const date = new Date(match.kickoff_at).toLocaleDateString('da-DK', {
        timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(match)
    }
    return Object.entries(groups)
  }, [recentMatches])

  return (
    <div className="flex flex-col gap-4">
      {/* SEKTION 1: Kampprogram i dag */}
      <div>
        <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">
          Kampprogram i dag
        </h2>
        <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
          {loading ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Indlæser...</p>
          ) : todayMatches.length === 0 ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Ingen kampe i dag</p>
          ) : (
            <div className="flex flex-col">
              {todayMatches.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 py-2"
                  style={{ borderBottom: i < todayMatches.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                >
                  {/* Home team */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                    <span className="text-[12px] font-semibold text-[#2c2418] uppercase">
                      {teamShort(m.home_team)}
                    </span>
                    {m.home_team?.logo_url && (
                      <img src={m.home_team.logo_url} alt="" title={m.home_team.name} className="w-5 h-5 object-contain flex-shrink-0" />
                    )}
                  </div>

                  {/* Time or score + status */}
                  <div className="flex items-center gap-1 min-w-[50px] justify-center">
                    {m.status === 'live' || m.status === 'halftime' ? (
                      <>
                        <span className="text-[12px] font-bold text-[#2c2418]">
                          {m.home_score ?? 0}-{m.away_score ?? 0}
                        </span>
                        <StatusBadge status={m.status} />
                      </>
                    ) : m.status === 'finished' ? (
                      <span className="text-[12px] font-bold text-[#2c2418]">
                        {m.home_score ?? 0}-{m.away_score ?? 0}
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-[#7a7060]">
                        {formatTime(m.kickoff_at)}
                      </span>
                    )}
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {m.away_team?.logo_url && (
                      <img src={m.away_team.logo_url} alt="" title={m.away_team.name} className="w-5 h-5 object-contain flex-shrink-0" />
                    )}
                    <span className="text-[12px] font-semibold text-[#2c2418] uppercase">
                      {teamShort(m.away_team)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEKTION 2: Gårsdagens resultater */}
      {!loading && yesterdayMatches.length > 0 && (
        <div>
          <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">
            Gårsdagens resultater
          </h2>
          <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
            <div className="flex flex-col">
              {yesterdayMatches.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: i < yesterdayMatches.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
                >
                  {/* Home team */}
                  <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                    <span className="text-[11px] font-semibold text-[#2c2418] uppercase">
                      {teamShort(m.home_team)}
                    </span>
                    {m.home_team?.logo_url && (
                      <img src={m.home_team.logo_url} alt="" title={m.home_team.name} className="w-4 h-4 object-contain flex-shrink-0" />
                    )}
                  </div>

                  {/* Score */}
                  <span className="text-[11px] font-bold text-[#2c2418] min-w-[32px] text-center">
                    {m.home_score ?? '-'}-{m.away_score ?? '-'}
                  </span>

                  {/* Away team */}
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {m.away_team?.logo_url && (
                      <img src={m.away_team.logo_url} alt="" title={m.away_team.name} className="w-4 h-4 object-contain flex-shrink-0" />
                    )}
                    <span className="text-[11px] font-semibold text-[#2c2418] uppercase">
                      {teamShort(m.away_team)}
                    </span>
                  </div>

                  {/* Kickoff time */}
                  <span className="text-[10px] text-[#7a7060] flex-shrink-0">
                    {formatTime(m.kickoff_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SEKTION 3: Seneste kampe */}
      {recentMatches.length > 0 && (
        <div>
          <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">
            Seneste kampe
          </h2>
          <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
            <div className="flex flex-col max-h-[340px] overflow-y-auto scrollbar-hide">
              {groupedByDate.map(([date, matches], gi) => (
                <div key={date}>
                  <p
                    className="text-[9px] font-bold text-[#7a7060] uppercase tracking-wider py-1.5"
                    style={{ borderTop: gi > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none' }}
                  >
                    {date}
                  </p>
                  {matches.map((m, i) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 py-1.5"
                      style={{ borderBottom: i < matches.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
                    >
                      {/* Home team */}
                      <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                        <span className="text-[11px] font-semibold text-[#2c2418] uppercase">
                          {teamShort(m.home_team)}
                        </span>
                        {m.home_team?.logo_url && (
                          <img src={m.home_team.logo_url} alt="" title={m.home_team.name} className="w-4 h-4 object-contain flex-shrink-0" />
                        )}
                      </div>

                      {/* Score */}
                      <span className="text-[11px] font-bold text-[#2c2418] min-w-[32px] text-center">
                        {m.home_score ?? '-'}-{m.away_score ?? '-'}
                      </span>

                      {/* Away team */}
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {m.away_team?.logo_url && (
                          <img src={m.away_team.logo_url} alt="" title={m.away_team.name} className="w-4 h-4 object-contain flex-shrink-0" />
                        )}
                        <span className="text-[11px] font-semibold text-[#2c2418] uppercase">
                          {teamShort(m.away_team)}
                        </span>
                      </div>

                      {/* Kickoff time */}
                      <span className="text-[10px] text-[#7a7060] flex-shrink-0">
                        {formatTime(m.kickoff_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI nyheder placeholder */}
      <div className="bg-white rounded-2xl border border-black/8 px-5 py-5">
        <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider mb-2">
          📰 Bodega Bets Nyheder
        </p>
        <p className="text-[13px] text-[#7a7060] italic">
          Nyheder kommer snart...
        </p>
      </div>

      {/* Join game */}
      <div className="hidden lg:block">
        <JoinGameCard />
      </div>
    </div>
  )
}
