'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AdminOverviewTab } from './tabs/AdminOverviewTab'
import LeagueHubClient, { TournamentRow } from './LeagueHubClient'
import { AdminSeasonsTab } from './tabs/AdminSeasonsTab'
import { AdminGamesTab } from './tabs/AdminGamesTab'
import { AdminUsersTab } from './tabs/AdminUsersTab'
import { AdminLogsTab } from './tabs/AdminLogsTab'
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
  adminSecret: string
}

export default function AdminTabClient({
  tournaments,
  lastSync,
  adminSecret,
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
      {/* Sport switcher */}
      <nav className="flex gap-1 border-b border-warm-border pb-0">
        {SPORTS.map((s) => (
          <Link
            key={s.id}
            href={`/admin?sport=${s.id}${s.id === 'cycling' ? '&tab=cycling-overview' : '&tab=overview'}`}
            className={`px-5 py-3 text-[13px] font-condensed font-bold uppercase tracking-[0.08em] transition-colors -mb-px ${
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

      {/* Tab navigation */}
      <nav className="flex gap-1 border-b border-black/10 pb-0 -mt-4">
        {activeTabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin?sport=${validSport}&tab=${t.id}`}
            className={`px-4 py-3 text-[12px] font-bold uppercase tracking-wide transition-colors -mb-px ${
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
            <AdminOverviewTab adminSecret={adminSecret} />
          )}
          {validTab === 'fixtures' && (
            <LeagueHubClient
              tournaments={tournaments}
              lastSync={lastSync}
            />
          )}
          {validTab === 'seasons' && (
            <AdminSeasonsTab adminSecret={adminSecret} />
          )}
          {validTab === 'games' && (
            <AdminGamesTab adminSecret={adminSecret} sport="football" />
          )}
          {validTab === 'users' && <AdminUsersTab adminSecret={adminSecret} />}
          {validTab === 'logs' && <AdminLogsTab adminSecret={adminSecret} />}
          {validTab === 'championship' && <AdminChampionshipTab adminSecret={adminSecret} />}
          {validTab === 'live-test' && <LiveTestTab />}
        </>
      )}

      {/* Cycling tab content */}
      {validSport === 'cycling' && (
        <>
          {validTab === 'cycling-overview' && (
            <AdminCyclingDashboardTab adminSecret={adminSecret} />
          )}
          {validTab === 'cycling-riders' && (
            <AdminCyclingRidersTab adminSecret={adminSecret} />
          )}
          {validTab === 'cycling-races' && (
            <AdminCyclingRacesTab adminSecret={adminSecret} />
          )}
          {validTab === 'cycling-games' && (
            <AdminGamesTab adminSecret={adminSecret} sport="cycling" />
          )}
        </>
      )}
    </div>
  )
}
