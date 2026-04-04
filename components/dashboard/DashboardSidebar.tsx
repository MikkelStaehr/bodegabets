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
  return d.toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' })
}

function getLeague(m: ScheduleMatch): League | null {
  return m.round?.season?.tournament ?? null
}

function groupByLeague(matches: ScheduleMatch[]): Array<{ league: League; matches: ScheduleMatch[] }> {
  const map = new Map<string, { league: League; matches: ScheduleMatch[] }>()
  for (const m of matches) {
    const league = getLeague(m)
    const key = league?.name ?? 'Ukendt'
    if (!map.has(key)) {
      map.set(key, { league: league ?? { name: 'Ukendt', logo_url: null }, matches: [] })
    }
    map.get(key)!.matches.push(m)
  }
  return [...map.values()]
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
  const [activeTab, setActiveTab] = useState<'today' | 'yesterday'>('today')

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
      <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b border-black/[0.07]">
          {[
            { key: 'today', label: 'Kampprogram i dag' },
            { key: 'yesterday', label: 'Gårsdagens resultater' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'today' | 'yesterday')}
              className="flex-1 py-3 font-condensed text-[11px] font-bold uppercase tracking-widest transition-colors"
              style={{
                color: activeTab === key ? '#1a3329' : '#9E9486',
                borderBottom: activeTab === key ? '2px solid #1a3329' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Liga filter tabs */}
        {!loading && uniqueLeagues.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 flex-wrap">
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
            {uniqueLeagues.map((league) => {
              const count = allScheduleMatches.filter(
                (m) => getLeague(m)?.name === league.name
              ).length
              return (
                <button
                  key={league.name}
                  onClick={() => setLeagueFilter(leagueFilter === league.name ? null : league.name)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full transition-colors"
                  title={league.name}
                  style={{
                    background: leagueFilter === league.name ? 'rgba(184,150,62,0.15)' : 'transparent',
                    border: leagueFilter === league.name ? '1.5px solid rgba(184,150,62,0.4)' : '1.5px solid transparent',
                  }}
                >
                  {league.logo_url ? (
                    <img src={league.logo_url} alt="" className="w-4 h-4 object-contain shrink-0" />
                  ) : (
                    <span className="text-[10px] text-[#7a7060]">{league.name.slice(0, 2)}</span>
                  )}
                  <span className={`text-[10px] font-bold ${leagueFilter === league.name ? 'text-[#B8963E]' : 'text-[#9E9486]'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Indhold */}
        <div className="px-4 py-3">
          {loading ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Indlæser...</p>
          ) : activeTab === 'today' ? (
            filteredToday.length === 0 ? (
              <p className="text-[13px] text-[#7a7060] text-center py-2">Ingen kampe i dag</p>
            ) : (
              <div className="flex flex-col">
                {(leagueFilter
                  ? [{ league: { name: leagueFilter, logo_url: null }, matches: filteredToday }]
                  : groupByLeague(filteredToday)
                ).map((group, gi) => (
                  <div key={group.league.name}>
                    {!leagueFilter && (
                      <div className={`flex items-center gap-2 ${gi > 0 ? 'mt-3' : ''} mb-1.5`}>
                        {group.league.logo_url && (
                          <img src={group.league.logo_url} alt="" className="w-3.5 h-3.5 object-contain opacity-70" />
                        )}
                        <span className="text-[9px] font-bold text-[#9E9486] uppercase tracking-widest">
                          {group.league.name}
                        </span>
                        <div className="flex-1 h-px bg-black/[0.06]" />
                      </div>
                    )}
                    {group.matches.map((m, i) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 py-2.5"
                        style={{ borderBottom: i < group.matches.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-[12px] font-bold text-[#1a3329] truncate" style={{ maxWidth: 80 }}>
                            {m.home_team?.short_name ?? '?'}
                          </span>
                          {m.home_team?.logo_url && (
                            <img src={m.home_team.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-col items-center min-w-[52px]">
                          {m.status === 'live' ? (
                            <>
                              <span className="text-[13px] font-extrabold text-[#1a3329] leading-none">
                                {m.home_score ?? 0}–{m.away_score ?? 0}
                              </span>
                              <span className="text-[8px] font-bold text-red-500 uppercase tracking-wider mt-0.5">● Live</span>
                            </>
                          ) : m.status === 'halftime' ? (
                            <>
                              <span className="text-[13px] font-extrabold text-[#1a3329] leading-none">
                                {m.home_score ?? 0}–{m.away_score ?? 0}
                              </span>
                              <span className="text-[8px] font-bold text-orange-500 uppercase tracking-wider mt-0.5">HT</span>
                            </>
                          ) : m.status === 'finished' ? (
                            <span className="text-[13px] font-extrabold text-[#9E9486] leading-none">
                              {m.home_score ?? 0}–{m.away_score ?? 0}
                            </span>
                          ) : (
                            <span className="text-[12px] font-semibold text-[#7a7060]">
                              {formatTime(m.kickoff_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {m.away_team?.logo_url && (
                            <img src={m.away_team.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                          )}
                          <span className="text-[12px] font-bold text-[#1a3329] truncate" style={{ maxWidth: 80 }}>
                            {m.away_team?.short_name ?? '?'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredYesterday.length === 0 ? (
              <p className="text-[13px] text-[#7a7060] text-center py-2">Ingen resultater fra i går</p>
            ) : (
              <div className="flex flex-col">
                {(leagueFilter
                  ? [{ league: { name: leagueFilter, logo_url: null }, matches: filteredYesterday }]
                  : groupByLeague(filteredYesterday)
                ).map((group, gi) => (
                  <div key={group.league.name}>
                    {!leagueFilter && (
                      <div className={`flex items-center gap-2 ${gi > 0 ? 'mt-3' : ''} mb-1.5`}>
                        {group.league.logo_url && (
                          <img src={group.league.logo_url} alt="" className="w-3.5 h-3.5 object-contain opacity-70" />
                        )}
                        <span className="text-[9px] font-bold text-[#9E9486] uppercase tracking-widest">
                          {group.league.name}
                        </span>
                        <div className="flex-1 h-px bg-black/[0.06]" />
                      </div>
                    )}
                    {group.matches.map((m, i) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 py-2"
                        style={{ borderBottom: i < group.matches.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-[12px] font-bold text-[#1a3329] truncate" style={{ maxWidth: 80 }}>
                            {m.home_team?.short_name ?? '?'}
                          </span>
                          {m.home_team?.logo_url && (
                            <img src={m.home_team.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-[13px] font-extrabold text-[#9E9486] leading-none min-w-[52px] text-center">
                          {m.home_score ?? '-'}–{m.away_score ?? '-'}
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {m.away_team?.logo_url && (
                            <img src={m.away_team.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                          )}
                          <span className="text-[12px] font-bold text-[#1a3329] truncate" style={{ maxWidth: 80 }}>
                            {m.away_team?.short_name ?? '?'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* SEKTION 3: Join game */}
      <div className="hidden lg:block">
        <JoinGameCard />
      </div>
    </div>
  )
}
