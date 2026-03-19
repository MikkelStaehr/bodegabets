'use client'

import { useEffect, useState, useMemo } from 'react'
import JoinGameCard from './JoinGameCard'
import type { SportType } from './DashboardContent'

type ScheduleMatch = {
  id: number
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team: { short_name: string | null; logo_url: string | null } | null
  away_team: { short_name: string | null; logo_url: string | null } | null
  round: { season: { tournament: { name: string; logo_url: string | null } | null } | null } | null
}

type League = { name: string; logo_url: string | null }

function teamShort(team: { short_name: string | null; name?: string } | null): string {
  if (!team) return '?'
  return team.short_name || team.name?.slice(0, 3).toUpperCase() || '?'
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

function getLeague(m: ScheduleMatch): League | null {
  return m.round?.season?.tournament ?? null
}

function extractLeagues(matches: ScheduleMatch[]): League[] {
  const seen = new Map<string, string | null>()
  for (const m of matches) {
    const t = getLeague(m)
    if (t?.name && !seen.has(t.name)) seen.set(t.name, t.logo_url)
  }
  return [...seen.entries()].map(([name, logo_url]) => ({ name, logo_url }))
}

export default function DashboardSidebar({
  nextRoundDate,
  sportFilter,
}: {
  nextRoundDate: string | null
  sportFilter: 'all' | SportType
}) {
  const [todayMatches, setTodayMatches] = useState<ScheduleMatch[]>([])
  const [yesterdayMatches, setYesterdayMatches] = useState<ScheduleMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null)

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

  const allScheduleMatches = useMemo(() => [...todayMatches, ...yesterdayMatches], [todayMatches, yesterdayMatches])
  const uniqueLeagues = useMemo(() => extractLeagues(allScheduleMatches), [allScheduleMatches])

  const filteredToday = useMemo(() => {
    if (!leagueFilter) return todayMatches
    return todayMatches.filter((m) => getLeague(m)?.name === leagueFilter)
  }, [todayMatches, leagueFilter])

  const filteredYesterday = useMemo(() => {
    if (!leagueFilter) return yesterdayMatches
    return yesterdayMatches.filter((m) => getLeague(m)?.name === leagueFilter)
  }, [yesterdayMatches, leagueFilter])

  return (
    <div className="flex flex-col gap-4">
      {/* League filter tabs */}
      {!loading && uniqueLeagues.length > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setLeagueFilter(null)}
            className="text-[10px] font-bold px-2 py-1 rounded-full transition-colors"
            style={{
              background: !leagueFilter ? 'rgba(184,150,62,0.15)' : 'transparent',
              color: !leagueFilter ? '#B8963E' : '#7a7060',
            }}
          >
            Alle
          </button>
          {uniqueLeagues.map((league) => (
            <button
              key={league.name}
              onClick={() => setLeagueFilter(leagueFilter === league.name ? null : league.name)}
              className="flex items-center justify-center w-7 h-7 rounded-full transition-colors"
              title={league.name}
              style={{
                background: leagueFilter === league.name ? 'rgba(184,150,62,0.15)' : 'transparent',
                border: leagueFilter === league.name ? '1.5px solid rgba(184,150,62,0.4)' : '1.5px solid transparent',
              }}
            >
              {league.logo_url ? (
                <img src={league.logo_url} alt="" title={league.name} className="w-4 h-4 object-contain" />
              ) : (
                <span className="text-[10px] text-[#7a7060]">{league.name.slice(0, 2)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* SEKTION 1: Kampprogram i dag */}
      <div>
        <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">
          Kampprogram i dag
        </h2>
        <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
          {loading ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Indlæser...</p>
          ) : filteredToday.length === 0 ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Ingen kampe i dag</p>
          ) : (
            <div className="flex flex-col">
              {filteredToday.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 py-2"
                  style={{ borderBottom: i < filteredToday.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                >
                  {/* Home team */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                    <span className="text-[12px] font-semibold text-[#2c2418] uppercase">
                      {teamShort(m.home_team)}
                    </span>
                    {m.home_team?.logo_url && (
                      <img src={m.home_team.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
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
                      <img src={m.away_team.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
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
      {!loading && filteredYesterday.length > 0 && (
        <div>
          <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">
            Gårsdagens resultater
          </h2>
          <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
            <div className="flex flex-col">
              {filteredYesterday.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: i < filteredYesterday.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
                >
                  {/* Home team */}
                  <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                    <span className="text-[11px] font-semibold text-[#2c2418] uppercase">
                      {teamShort(m.home_team)}
                    </span>
                    {m.home_team?.logo_url && (
                      <img src={m.home_team.logo_url} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                    )}
                  </div>

                  {/* Score */}
                  <span className="text-[11px] font-bold text-[#2c2418] min-w-[32px] text-center">
                    {m.home_score ?? '-'}-{m.away_score ?? '-'}
                  </span>

                  {/* Away team */}
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {m.away_team?.logo_url && (
                      <img src={m.away_team.logo_url} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
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

      {/* SEKTION 3: Bodega Bets Nyheder */}
      <div className="bg-white rounded-2xl border border-black/8 px-5 py-5">
        <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider mb-2">
          📰 Bodega Bets Nyheder
        </p>
        <p className="text-[13px] text-[#7a7060] italic">
          Nyheder kommer snart...
        </p>
      </div>

      {/* SEKTION 4: Join game */}
      <div className="hidden lg:block">
        <JoinGameCard />
      </div>
    </div>
  )
}
