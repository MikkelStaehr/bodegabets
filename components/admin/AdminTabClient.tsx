'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AdminOverviewTab } from './tabs/AdminOverviewTab'
import LeagueHubClient from './LeagueHubClient'
import { AdminGamesTab } from './tabs/AdminGamesTab'
import { AdminUsersTab } from './tabs/AdminUsersTab'
import { AdminLogsTab } from './tabs/AdminLogsTab'
import { LiveTestTab } from './tabs/LiveTestTab'
import { TeamMappingTab } from './tabs/TeamMappingTab'

const TABS = [
  { id: 'overview', label: 'Overblik', icon: '◉' },
  { id: 'fixtures', label: 'Kampprogrammer', icon: '⚽' },
  { id: 'games', label: 'Spilrum', icon: '🏆' },
  { id: 'team-mapping', label: 'Mappings', icon: '🔗' },
  { id: 'users', label: 'Brugere', icon: '👤' },
  { id: 'logs', label: 'Logs', icon: '📋' },
  { id: 'live-test', label: 'LIVE TEST', icon: '🔴' },
] as const

type TabId = (typeof TABS)[number]['id']

export type LeagueRow = {
  id: number
  name: string
  country: string
  bold_slug: string | null
  fixturedownload_slug?: string | null
  last_synced_at?: string | null
  sync_status?: string | null
  sync_error?: string | null
  total_matches?: number
}

export type SyncLog = {
  id: number
  league_id: number
  synced_at: string
  matches_imported: number
  status: string
  message: string
}

export type GameRow = {
  id: number
  name: string
  status: string
  invite_code: string
  created_at: string
  league_name: string
  member_count: number
  round_count: number
}

export type RoundRow = {
  id: number
  name: string
  status: 'upcoming' | 'open' | 'closed' | 'finished'
  betting_closes_at: string | null
  league_id: number
  game_name: string
  league_name: string
  match_count: number
}

export type MatchRow = {
  id: number
  round_id: number
  round_name: string
  game_name: string
  home_team: string
  away_team: string
  kickoff_at: string | null
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'finished'
  existing_sidebet_types: string[]
}

type Props = {
  leagues: LeagueRow[]
  syncLogs: SyncLog[]
  games: GameRow[]
  rounds: RoundRow[]
  matches: MatchRow[]
  adminSecret: string
}

export default function AdminTabClient({
  leagues,
  syncLogs,
  games,
  rounds,
  matches,
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
          leagues={leagues.map((l) => ({
            id: l.id,
            name: l.name,
            country: l.country,
            bold_slug: l.bold_slug,
            fixturedownload_slug: l.fixturedownload_slug ?? null,
            last_synced_at: l.last_synced_at ?? null,
            sync_status: l.sync_status ?? null,
            sync_error: l.sync_error ?? null,
            total_matches: l.total_matches ?? 0,
          }))}
          logs={syncLogs}
        />
      )}
      {validTab === 'games' && (
        <AdminGamesTab adminSecret={adminSecret} />
      )}
      {validTab === 'team-mapping' && (
        <TeamMappingTab adminSecret={adminSecret} />
      )}
      {validTab === 'users' && <AdminUsersTab adminSecret={adminSecret} />}
      {validTab === 'logs' && <AdminLogsTab adminSecret={adminSecret} />}
      {validTab === 'live-test' && <LiveTestTab />}
    </div>
  )
}
