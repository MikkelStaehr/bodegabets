'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AdminOverviewTab } from './tabs/AdminOverviewTab'
import LeagueHubClient, { TournamentRow } from './LeagueHubClient'
import { AdminSeasonsTab } from './tabs/AdminSeasonsTab'
import { AdminGamesTab } from './tabs/AdminGamesTab'
import { AdminUsersTab } from './tabs/AdminUsersTab'
import { AdminLogsTab } from './tabs/AdminLogsTab'
import { AdminAuditTab } from './tabs/AdminAuditTab'
import { LiveTestTab } from './tabs/LiveTestTab'
import { AdminChampionshipTab } from './tabs/AdminChampionshipTab'
import { AdminCyclingDashboardTab } from './tabs/cycling/AdminCyclingDashboardTab'
import { AdminCyclingRidersTab } from './tabs/cycling/AdminCyclingRidersTab'
import { AdminCyclingRacesTab } from './tabs/cycling/AdminCyclingRacesTab'

const SPORTS = [
  { id: 'football', label: 'Fodbold', icon: '⚽' },
  { id: 'cycling', label: 'Cykling', icon: '🚴' },
] as const

type SportId = (typeof SPORTS)[number]['id']

const FOOTBALL_TABS = [
  { id: 'overview', label: 'Overblik', icon: '◉' },
  { id: 'fixtures', label: 'Kampprogrammer', icon: '⚽' },
  { id: 'seasons', label: 'Sæsoner', icon: '📅' },
  { id: 'games', label: 'Spilrum', icon: '🏆' },
  { id: 'users', label: 'Brugere', icon: '👤' },
  { id: 'logs', label: 'Logs', icon: '📋' },
  { id: 'audit', label: 'Audit log', icon: '🔍' },
  { id: 'championship', label: 'Mesterskabet', icon: '🏅' },
  { id: 'live-test', label: 'LIVE TEST', icon: '🔴' },
] as const

const CYCLING_TABS = [
  { id: 'cycling-overview', label: 'Oversigt', icon: '◉' },
  { id: 'cycling-riders', label: 'Ryttere', icon: '🚴' },
  { id: 'cycling-races', label: 'Løb', icon: '🏔' },
  { id: 'cycling-games', label: 'Spilrum', icon: '🏆' },
] as const

type FootballTabId = (typeof FOOTBALL_TABS)[number]['id']
type CyclingTabId = (typeof CYCLING_TABS)[number]['id']

type Props = {
  tournaments: TournamentRow[]
  lastSync: string | null
}

export default function AdminTabClient({
  tournaments,
  lastSync,
  }: Props) {
  const searchParams = useSearchParams()
  const sport = (searchParams.get('sport') ?? 'football') as SportId
  const validSport = SPORTS.some((s) => s.id === sport) ? sport : 'football'

  const tab = searchParams.get('tab') ?? (validSport === 'cycling' ? 'cycling-overview' : 'overview')
  const validTab = validSport === 'cycling'
    ? (CYCLING_TABS.some((t) => t.id === tab) ? tab : 'cycling-overview') as CyclingTabId
    : (FOOTBALL_TABS.some((t) => t.id === tab) ? tab : 'overview') as FootballTabId

  const activeTabs = validSport === 'cycling' ? CYCLING_TABS : FOOTBALL_TABS
  const defaultTab = validSport === 'cycling' ? 'cycling-overview' : 'overview'

  return (
    <div className="space-y-8">
      {/* Sport switcher — horizontalt scroll på mobil */}
      <nav className="flex gap-1 border-b border-warm-border overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {SPORTS.map((s) => (
          <Link
            key={s.id}
            href={`/admin?sport=${s.id}${s.id === 'cycling' ? '&tab=cycling-overview' : '&tab=overview'}`}
            className={`px-4 sm:px-5 py-3 text-[13px] font-condensed font-bold uppercase tracking-[0.08em] transition-colors -mb-px whitespace-nowrap shrink-0 ${
              validSport === s.id
                ? 'text-forest border-b-2 border-forest'
                : 'text-warm-gray hover:text-ink border-b-2 border-transparent'
            }`}
          >
            <span className="mr-2">{s.icon}</span>
            {s.label}
          </Link>
        ))}
      </nav>

      {/* Tab navigation — horizontalt scroll på mobil */}
      <nav className="flex gap-1 border-b border-black/10 -mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {activeTabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin?sport=${validSport}&tab=${t.id}`}
            className={`px-3 sm:px-4 py-3 text-[12px] font-bold uppercase tracking-wide transition-colors -mb-px whitespace-nowrap shrink-0 ${
              validTab === t.id
                ? 'text-forest border-b-2 border-forest'
                : 'text-warm-gray hover:text-ink border-b-2 border-transparent'
            }`}
          >
            <span className="mr-1.5 opacity-70">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Football tab content */}
      {validSport === 'football' && (
        <>
          {validTab === 'overview' && (
            <AdminOverviewTab />
          )}
          {validTab === 'fixtures' && (
            <LeagueHubClient
              tournaments={tournaments}
              lastSync={lastSync}
            />
          )}
          {validTab === 'seasons' && (
            <AdminSeasonsTab />
          )}
          {validTab === 'games' && (
            <AdminGamesTab sport="football" />
          )}
          {validTab === 'users' && <AdminUsersTab />}
          {validTab === 'logs' && <AdminLogsTab />}
          {validTab === 'audit' && <AdminAuditTab />}
          {validTab === 'championship' && <AdminChampionshipTab />}
          {validTab === 'live-test' && <LiveTestTab />}
        </>
      )}

      {/* Cycling tab content */}
      {validSport === 'cycling' && (
        <>
          {validTab === 'cycling-overview' && (
            <AdminCyclingDashboardTab />
          )}
          {validTab === 'cycling-riders' && (
            <AdminCyclingRidersTab />
          )}
          {validTab === 'cycling-races' && (
            <AdminCyclingRacesTab />
          )}
          {validTab === 'cycling-games' && (
            <AdminGamesTab sport="cycling" />
          )}
        </>
      )}
    </div>
  )
}
