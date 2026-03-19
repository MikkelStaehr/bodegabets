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
  home_team: { name: string; logo_url: string | null } | null
  away_team: { name: string; logo_url: string | null } | null
  round: { season: { tournament: { name: string; logo_url: string | null } | null } | null } | null
}

type LeaderboardEntry = {
  username: string
  total_bets: number
  correct_bets: number
  correct_pct: number
  total_earnings: number
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loadingLb, setLoadingLb] = useState(true)
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null)

  const uniqueLeagues = useMemo(() => {
    const seen = new Map<string, string | null>()
    for (const m of recentMatches) {
      const t = m.round?.season?.tournament
      if (t?.name && !seen.has(t.name)) {
        seen.set(t.name, t.logo_url)
      }
    }
    return [...seen.entries()].map(([name, logo_url]) => ({ name, logo_url }))
  }, [recentMatches])

  const filteredMatches = useMemo(() => {
    if (!leagueFilter) return recentMatches
    return recentMatches.filter((m) => m.round?.season?.tournament?.name === leagueFilter)
  }, [recentMatches, leagueFilter])

  const groupedByDate = useMemo(() => {
    const groups: Record<string, RecentMatch[]> = {}
    for (const match of filteredMatches) {
      const date = new Date(match.kickoff_at).toLocaleDateString('da-DK', {
        timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(match)
    }
    return Object.entries(groups)
  }, [filteredMatches])

  useEffect(() => {
    fetch('/api/users/global-leaderboard')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLeaderboard(data.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoadingLb(false))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* SEKTION 1: Globalt leaderboard */}
      <div>
        <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">
          Globalt leaderboard
        </h2>
        <div className="bg-white rounded-2xl border border-black/8 px-5 py-4">
          {loadingLb ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Indlæser...</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Ingen data endnu</p>
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.username}
                  className="flex items-center gap-3 py-1.5"
                  style={{ borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                >
                  <span
                    className="text-[13px] font-bold min-w-[20px] text-center"
                    style={{ color: i === 0 ? '#B8963E' : i === 1 ? '#8a8a8a' : i === 2 ? '#a0724a' : '#7a7060' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-medium text-[#2c2418] flex-1 truncate">
                    {entry.username}
                  </span>
                  <span className="text-[12px] font-semibold text-[#B8963E]">
                    {entry.correct_pct}%
                  </span>
                  <span className="text-[11px] text-[#7a7060] min-w-[50px] text-right">
                    {entry.total_earnings} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEKTION 2: Seneste kampe */}
      <div>
        <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">
          Seneste kampe
        </h2>

        {/* League filter tabs */}
        {uniqueLeagues.length > 1 && (
          <div className="flex items-center gap-1.5 mb-2">
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

        <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
          {filteredMatches.length === 0 ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Ingen afsluttede kampe endnu</p>
          ) : (
            <div className="flex flex-col max-h-[380px] overflow-y-auto scrollbar-hide">
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
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className="text-[12px] text-[#2c2418] truncate text-right">
                          {m.home_team?.name ?? '?'}
                        </span>
                        {m.home_team?.logo_url && (
                          <img src={m.home_team.logo_url} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                        )}
                      </div>

                      {/* Score */}
                      <span className="text-[12px] font-bold text-[#2c2418] min-w-[36px] text-center">
                        {m.home_score ?? '-'} – {m.away_score ?? '-'}
                      </span>

                      {/* Away team */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {m.away_team?.logo_url && (
                          <img src={m.away_team.logo_url} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                        )}
                        <span className="text-[12px] text-[#2c2418] truncate">
                          {m.away_team?.name ?? '?'}
                        </span>
                      </div>

                      {/* Kickoff time */}
                      <span className="text-[10px] text-[#7a7060] flex-shrink-0">
                        {new Date(m.kickoff_at).toLocaleTimeString('da-DK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEKTION 3: AI nyheder placeholder */}
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
