'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import DashboardGameCard from './DashboardGameCard'
import DashboardSidebar from './DashboardSidebar'
import JoinGameCard from './JoinGameCard'
import PushNotificationBanner from './PushNotificationBanner'
import NewsBox from './NewsBox'
import type { ScheduleMatch } from './NewsBox'

export type SportType = 'football' | 'cycling'

export type GameRowWithSport = {
  points: number
  rank: number
  bets_count: number
  game: {
    id: number
    name: string
    status: string
    invite_code: string
    member_count: number
    league_name: string | null
    sport_type: SportType
  }
  activeRound: {
    id: number
    name: string
    betting_closes_at: string | null
    matches_count: number
    round_status: 'upcoming' | 'active' | 'finished' | null
  } | null
}

type Round = {
  id: number
  name: string
  matches_count: number
}

const SPORT_THEMES = {
  football: {
    accent: '#B8963E',
    accentLight: 'rgba(184,150,62,0.15)',
    accentBorder: 'rgba(184,150,62,0.4)',
  },
  cycling: {
    accent: '#4A6FA5',
    accentLight: 'rgba(74,111,165,0.15)',
    accentBorder: 'rgba(74,111,165,0.4)',
  },
} as const

type TabKey = 'all' | SportType

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'all', label: 'Alle', emoji: '🏅' },
  { key: 'football', label: 'Fodbold', emoji: '⚽' },
  { key: 'cycling', label: 'Cykling', emoji: '🚴' },
]

type Top3Entry = { user_id: string; username: string; earnings: number }

export default function DashboardContent({
  games,
  activeRounds,
  nextRoundDate,
  logoUrlsByGame,
  leagueNamesByGame,
  top3ByGame,
  username,
}: {
  games: GameRowWithSport[]
  activeRounds: Round[]
  nextRoundDate: string | null
  logoUrlsByGame: Record<number, string[]>
  leagueNamesByGame: Record<number, string[]>
  top3ByGame: Record<number, Top3Entry[]>
  username: string
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [transitioning, setTransitioning] = useState(false)
  const [yesterdayMatches, setYesterdayMatches] = useState<ScheduleMatch[]>([])

  useEffect(() => {
    fetch('/api/dashboard/todays-matches')
      .then((r) => r.json())
      .then((data) => {
        if (data.yesterday) setYesterdayMatches(data.yesterday)
      })
      .catch(() => {})
  }, [])

  const counts = useMemo(() => {
    const active = games.filter((g) => g.game.status === 'active')
    return {
      all: active.length,
      football: active.filter((g) => g.game.sport_type === 'football').length,
      cycling: active.filter((g) => g.game.sport_type === 'cycling').length,
    }
  }, [games])

  const filtered = useMemo(() => {
    if (activeTab === 'all') return games
    return games.filter((g) => g.game.sport_type === activeTab)
  }, [games, activeTab])

  const activeGames = filtered.filter((g) => g.game.status === 'active')
  const finishedGames = filtered.filter((g) => g.game.status === 'finished')

  const theme = activeTab === 'all' || activeTab === 'football'
    ? SPORT_THEMES.football
    : SPORT_THEMES[activeTab]

  function handleTabChange(tab: TabKey) {
    if (tab === activeTab) return
    setTransitioning(true)
    setTimeout(() => {
      setActiveTab(tab)
      setTransitioning(false)
    }, 150)
  }

  return (
    <div
      style={{
        '--accent': theme.accent,
        '--accent-light': theme.accentLight,
        '--accent-border': theme.accentBorder,
        transition: 'color 0.3s ease, background 0.3s ease',
      } as React.CSSProperties}
    >
      {/* Header — user info + NewsBox */}
      <div className="flex items-start justify-between gap-6 mb-6">
        {/* Venstre — bruger info + opret knap på samme linje */}
        <div>
          <p className="text-[11px] font-semibold text-[#7a7060] uppercase tracking-widest mb-1">
            Velkommen tilbage
          </p>
          <div className="flex items-center gap-4">
            <h1 className="font-['Playfair_Display'] text-4xl font-bold text-[#1a3329]">
              {username}
            </h1>
            <Link
              href="/games/new"
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#2C4A3E] border border-[#2C4A3E]/30 px-4 py-2 rounded-lg hover:bg-[#2C4A3E]/5 transition-colors"
            >
              + Opret spil
            </Link>
          </div>
          <p className="text-[13px] text-[#7a7060] mt-1">
            {games.length} {games.length === 1 ? 'spilrum' : 'spilrum'} · {new Date().toLocaleDateString('da-DK', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Højre — nyhedsboks max 380px */}
        <div className="hidden lg:block w-[380px] shrink-0">
          <NewsBox matches={yesterdayMatches} />
        </div>
      </div>

      <PushNotificationBanner />

      {/* Sport tabs */}
      <div className="mb-4 -mx-4 px-4 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-1 min-w-max">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className="relative flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg transition-all duration-300 whitespace-nowrap"
                style={{
                  minHeight: '44px',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent)' : '#7a7060',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                <span
                  className="text-[11px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center transition-colors duration-300"
                  style={{
                    background: isActive ? 'var(--accent)' : '#e5e0d6',
                    color: isActive ? '#fff' : '#7a7060',
                  }}
                >
                  {counts[tab.key]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left — game rooms */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest">Dine spilrum</h2>

          <div
            className="flex flex-col gap-4 transition-opacity duration-300 ease-in-out"
            style={{ opacity: transitioning ? 0 : 1 }}
          >
            {activeGames.length === 0 && finishedGames.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/8 p-12 text-center">
                <p className="text-[#7a7060] mb-4">
                  {activeTab === 'all'
                    ? 'Du er ikke med i nogen spilrum endnu'
                    : `Ingen ${activeTab === 'football' ? 'fodbold' : 'cykling'}-spilrum`}
                </p>
              </div>
            ) : (
              <>
                {activeGames.map((row) => (
                  <DashboardGameCard key={row.game.id} row={row} logoUrls={logoUrlsByGame[row.game.id]} leagueNames={leagueNamesByGame[row.game.id]} top3={top3ByGame[row.game.id]} />
                ))}
                {finishedGames.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">Afsluttede spil</h3>
                    <div className="flex flex-col gap-4 opacity-75">
                      {finishedGames.map((row) => (
                        <DashboardGameCard key={row.game.id} row={row} logoUrls={logoUrlsByGame[row.game.id]} leagueNames={leagueNamesByGame[row.game.id]} top3={top3ByGame[row.game.id]} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Invite box — under card list on mobile */}
          <div className="lg:hidden mt-2">
            <JoinGameCard />
          </div>
        </div>

        {/* Right — sidebar (desktop) */}
        <div className="hidden lg:block">
          <DashboardSidebar
            nextRoundDate={nextRoundDate}
            sportFilter={activeTab}
          />
        </div>
      </div>
    </div>
  )
}
