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
import { AdminKnockoutTab } from './tabs/AdminKnockoutTab'
import { AdminCyclingDashboardTab } from './tabs/cycling/AdminCyclingDashboardTab'
import { AdminCyclingRidersTab } from './tabs/cycling/AdminCyclingRidersTab'
import { AdminCyclingRacesTab } from './tabs/cycling/AdminCyclingRacesTab'

// 3-niveau struktur: Section (System | Fodbold | Cykling) → Tabs i sektionen
const SECTIONS = [
  { id: 'system', label: 'System', icon: '⚙' },
  { id: 'football', label: 'Fodbold', icon: '⚽' },
  { id: 'cycling', label: 'Cykling', icon: '🚴' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

const SYSTEM_TABS = [
  { id: 'users', label: 'Brugere', icon: '👤' },
  { id: 'audit', label: 'Audit log', icon: '🔍' },
  { id: 'logs', label: 'Logs', icon: '📋' },
] as const

const FOOTBALL_TABS = [
  { id: 'overview', label: 'Overblik', icon: '◉' },
  { id: 'fixtures', label: 'Kampprogrammer', icon: '⚽' },
  { id: 'seasons', label: 'Sæsoner', icon: '📅' },
  { id: 'games', label: 'Spilrum', icon: '🏆' },
  { id: 'championship', label: 'Mesterskabet', icon: '🏅' },
  { id: 'knockout', label: 'Knockout', icon: '⚔️' },
  { id: 'live-test', label: 'LIVE TEST', icon: '🔴' },
] as const

const CYCLING_TABS = [
  { id: 'cycling-overview', label: 'Oversigt', icon: '◉' },
  { id: 'cycling-riders', label: 'Ryttere', icon: '🚴' },
  { id: 'cycling-races', label: 'Løb', icon: '🏔' },
  { id: 'cycling-games', label: 'Spilrum', icon: '🏆' },
] as const

const DEFAULT_TAB: Record<SectionId, string> = {
  system: 'users',
  football: 'overview',
  cycling: 'cycling-overview',
}

function getTabsForSection(section: SectionId) {
  switch (section) {
    case 'system':
      return SYSTEM_TABS
    case 'football':
      return FOOTBALL_TABS
    case 'cycling':
      return CYCLING_TABS
  }
}

type Props = {
  tournaments: TournamentRow[]
  lastSync: string | null
}

export default function AdminTabClient({ tournaments, lastSync }: Props) {
  const searchParams = useSearchParams()
  // Backwards-compat: ?sport=… fra gamle bookmarks mapper til ?section=…
  const rawSection =
    searchParams.get('section') ?? searchParams.get('sport') ?? 'system'
  const validSection = (SECTIONS.some((s) => s.id === rawSection) ? rawSection : 'system') as SectionId

  const activeTabs = getTabsForSection(validSection)
  const tab = searchParams.get('tab') ?? DEFAULT_TAB[validSection]
  const validTab = activeTabs.some((t) => t.id === tab) ? tab : DEFAULT_TAB[validSection]

  return (
    <div className="space-y-8">
      {/* Section switcher — horizontalt scroll på mobil */}
      <nav className="flex gap-1 border-b border-warm-border overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/admin?section=${s.id}&tab=${DEFAULT_TAB[s.id]}`}
            className={`px-4 sm:px-5 py-3 text-[13px] font-condensed font-bold uppercase tracking-[0.08em] transition-colors -mb-px whitespace-nowrap shrink-0 ${
              validSection === s.id
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
            href={`/admin?section=${validSection}&tab=${t.id}`}
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

      {/* System tab content */}
      {validSection === 'system' && (
        <>
          {validTab === 'users' && <AdminUsersTab />}
          {validTab === 'audit' && <AdminAuditTab />}
          {validTab === 'logs' && <AdminLogsTab />}
        </>
      )}

      {/* Football tab content */}
      {validSection === 'football' && (
        <>
          {validTab === 'overview' && <AdminOverviewTab />}
          {validTab === 'fixtures' && (
            <LeagueHubClient tournaments={tournaments} lastSync={lastSync} />
          )}
          {validTab === 'seasons' && <AdminSeasonsTab />}
          {validTab === 'games' && <AdminGamesTab sport="football" />}
          {validTab === 'championship' && <AdminChampionshipTab />}
          {validTab === 'knockout' && <AdminKnockoutTab />}
          {validTab === 'live-test' && <LiveTestTab />}
        </>
      )}

      {/* Cycling tab content */}
      {validSection === 'cycling' && (
        <>
          {validTab === 'cycling-overview' && <AdminCyclingDashboardTab />}
          {validTab === 'cycling-riders' && <AdminCyclingRidersTab />}
          {validTab === 'cycling-races' && <AdminCyclingRacesTab />}
          {validTab === 'cycling-games' && <AdminGamesTab sport="cycling" />}
        </>
      )}
    </div>
  )
}
