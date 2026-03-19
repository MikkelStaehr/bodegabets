'use client'

import { useEffect, useState } from 'react'
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
        <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
          {recentMatches.length === 0 ? (
            <p className="text-[13px] text-[#7a7060] text-center py-2">Ingen afsluttede kampe endnu</p>
          ) : (
            <div className="flex flex-col max-h-[340px] overflow-y-auto scrollbar-hide">
              {recentMatches.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 py-2"
                  style={{ borderBottom: i < recentMatches.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
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
