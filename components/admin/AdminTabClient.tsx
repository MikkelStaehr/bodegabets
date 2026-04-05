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

const TABS = [
  { id: 'overview', label: 'Overblik', icon: '◉' },
  { id: 'fixtures', label: 'Kampprogrammer', icon: '⚽' },
  { id: 'seasons', label: 'Sæsoner', icon: '📅' },
  { id: 'games', label: 'Spilrum', icon: '🏆' },
  { id: 'users', label: 'Brugere', icon: '👤' },
  { id: 'logs', label: 'Logs', icon: '📋' },
  { id: 'championship', label: 'Mesterskabet', icon: '🏅' },
  { id: 'live-test', label: 'LIVE TEST', icon: '🔴' },
] as const

type TabId = (typeof TABS)[number]['id']

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
  const tab = (searchParams.get('tab') ?? 'overview') as TabId
  const validTab = TABS.some((t) => t.id === tab) ? tab : 'overview'

  return (
    <div className="space-y-8">
      {/* Tab navigation */}
      <nav className="flex gap-1 border-b border-black/10 pb-0">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            className={`px-4 py-3 text-[12px] font-bold uppercase tracking-wide transition-colors -mb-px ${
              validTab === t.id
                ? 'text-[#2C4A3E] border-b-2 border-[#2C4A3E]'
                : 'text-[#7a7060] hover:text-[#1a3329] border-b-2 border-transparent'
            }`}
          >
            <span className="mr-1.5 opacity-70">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Tab content */}
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
        <AdminGamesTab adminSecret={adminSecret} />
      )}
      {validTab === 'users' && <AdminUsersTab adminSecret={adminSecret} />}
      {validTab === 'logs' && <AdminLogsTab adminSecret={adminSecret} />}
      {validTab === 'championship' && <AdminChampionshipTab adminSecret={adminSecret} />}
      {validTab === 'live-test' && <LiveTestTab />}
    </div>
  )
}
