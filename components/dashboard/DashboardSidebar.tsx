'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
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

type NewsItem = {
  headline: string
  body: string
  match: ScheduleMatch
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

function NewsBox({ matches }: { matches: ScheduleMatch[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (matches.length === 0) {
      setLoading(false)
      return
    }

    fetch('/api/anthropic/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Du er sportsjournalist for Bodega Bets — en privat fantasy betting app.

Skriv korte danske sportsnyhedsoverskrifter og tekster for disse kampe.
Svar KUN med JSON array, ingen markdown:
[
  {
    "match_id": number,
    "headline": "3-5 ord overskrift",
    "body": "2-3 sætninger om kampen i avisagtig tone"
  }
]
Kampe:
${JSON.stringify(
  matches.map((m) => ({
    id: m.id,
    home: m.home_team?.short_name,
    away: m.away_team?.short_name,
    score: (m.home_score ?? 0) + '-' + (m.away_score ?? 0),
    tournament: m.round?.season?.tournament?.name,
  }))
)}
Skriv på dansk. Vær kortfattet og fængende.`,
          },
        ],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const text = data.content?.[0]?.text
        if (!text) return
        const parsed: { match_id: number; headline: string; body: string }[] = JSON.parse(text)
        const items: NewsItem[] = parsed
          .map((p) => {
            const match = matches.find((m) => m.id === p.match_id)
            if (!match) return null
            return { headline: p.headline, body: p.body, match }
          })
          .filter((x): x is NewsItem => x !== null)
        setNews(items)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [matches])

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (news.length > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIndex((i) => (i + 1) % news.length)
      }, 20000)
    }
  }, [news.length])

  useEffect(() => {
    resetInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [resetInterval])

  function handleClick(i: number) {
    setActiveIndex(i)
    resetInterval()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
        <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider px-5 pt-4 pb-2">
          Bodega Bets Nyheder
        </p>
        <div className="px-5 pb-4 space-y-3">
          <div className="h-3 bg-black/5 rounded-full w-3/4 animate-pulse" />
          <div className="h-3 bg-black/5 rounded-full w-1/2 animate-pulse" />
          <div className="h-10 bg-black/5 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
        <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider px-5 pt-4 pb-2">
          Bodega Bets Nyheder
        </p>
        <p className="text-[12px] text-[#7a7060] px-5 pb-4">Ingen kampe i går</p>
      </div>
    )
  }

  if (error || news.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
        <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider px-5 pt-4 pb-2">
          Bodega Bets Nyheder
        </p>
        <p className="text-[12px] text-[#7a7060] px-5 pb-4">Nyheder ikke tilgængelige lige nu</p>
      </div>
    )
  }

  const activeNews = news[activeIndex] ?? news[0]

  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider px-5 pt-4 pb-2">
        Bodega Bets Nyheder
      </p>

      <div className="flex">
        {/* Venstre — overskrifter */}
        <div className="w-[140px] shrink-0 border-r border-black/8 py-2">
          {news.map((n, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`w-full text-left px-4 py-2 text-[11px] font-semibold leading-tight transition-colors ${
                i === activeIndex ? 'text-[#1a3329] bg-black/4' : 'text-[#7a7060]'
              }`}
            >
              {n.headline}
            </button>
          ))}
        </div>

        {/* Højre — aktiv nyhed */}
        <div className="flex-1 px-4 py-3">
          {/* Hold logoer overlappende */}
          <div className="flex items-center mb-3 relative h-8">
            {activeNews.match.home_team?.logo_url && (
              <img
                src={activeNews.match.home_team.logo_url}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-white z-10 relative object-contain"
              />
            )}
            {activeNews.match.away_team?.logo_url && (
              <img
                src={activeNews.match.away_team.logo_url}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-white -ml-2 object-contain"
              />
            )}
            <span className="ml-2 text-[11px] text-[#7a7060]">
              {activeNews.match.home_score ?? 0}-{activeNews.match.away_score ?? 0}
            </span>
          </div>

          <p className="text-[13px] text-[#1a3329] leading-relaxed">{activeNews.body}</p>

          {/* Auto-progress indikator */}
          <div className="flex gap-1 mt-3">
            {news.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full flex-1 ${i === activeIndex ? 'bg-[#1a3329]' : 'bg-black/10'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
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
      {!loading && filteredYesterday.length > 0 && (
        <NewsBox matches={filteredYesterday} />
      )}

      {/* SEKTION 4: Join game */}
      <div className="hidden lg:block">
        <JoinGameCard />
      </div>
    </div>
  )
}
