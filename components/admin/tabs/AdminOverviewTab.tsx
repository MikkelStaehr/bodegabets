'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  adminSecret: string
}

type StatusData = {
  cron: { lastRun: string | null; nextRun: string | null; isHealthy: boolean }
  boldApi: { lastSync: string | null; isHealthy: boolean; errorCount: number }
}

type RoundInfo = {
  id: number
  name: string
  kickoff_date: string
  status: string
  matchCount?: number
  betsCount?: number
}

type LeagueOverview = {
  id: number
  name: string
  country: string
  activeRooms: number
  totalBets: number
  previousRound: RoundInfo | null
  currentRound: RoundInfo | null
  nextRound: RoundInfo | null
}

type MatchRow = {
  id: number
  home_team: string
  away_team: string
  kickoff_at: string
  status: string
  is_excluded: boolean
  excluded_reason: string | null
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `${mins} min siden`
  if (hours < 24) return `${hours} t siden`
  if (days < 7) return `${days} d siden`
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('da-DK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusCard({
  title,
  status,
  detail,
  sub,
}: {
  title: string
  status: 'ok' | 'error'
  detail: string
  sub: string
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 ${
        status === 'ok' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
          status === 'ok' ? 'bg-green-500' : 'bg-red-500 animate-pulse'
        }`}
      />
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-[#1a3329] uppercase tracking-wide">{title}</p>
        <p className="text-[13px] text-[#1a3329] mt-0.5">{detail}</p>
        <p className="text-[11px] text-[#7a7060] mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'text-amber-600 bg-amber-50 border-amber-200',
  open: 'text-green-600 bg-green-50 border-green-200',
  closed: 'text-red-600/80 bg-red-50 border-red-200',
  finished: 'text-[#7a7060] bg-black/5 border-black/10',
  scheduled: 'text-[#7a7060] bg-black/5 border-black/10',
  live: 'text-red-600 bg-red-50 border-red-200',
  halftime: 'text-amber-600 bg-amber-50 border-amber-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_COLORS[status] ?? 'bg-black/5 text-[#7a7060]'}`}>
      {status}
    </span>
  )
}

function MatchList({
  roundId,
  adminSecret,
  onExcludeChange,
}: {
  roundId: number
  adminSecret: string
  onExcludeChange: () => void
}) {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [excludeLoading, setExcludeLoading] = useState<Set<number>>(new Set())
  const authHeader = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSecret}` } as const

  useEffect(() => {
    fetch(`/api/admin/rounds/${roundId}/matches`, {
      headers: { Authorization: `Bearer ${adminSecret}` },
      credentials: 'same-origin',
    })
      .then((r) => r.json())
      .then((d) => setMatches(d.matches ?? []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [roundId, adminSecret])

  async function toggleExclude(matchId: number, isExcluded: boolean) {
    setExcludeLoading((s) => new Set(s).add(matchId))
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/exclude`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ excluded: !isExcluded }),
      })
      if (res.ok) {
        setMatches((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, is_excluded: !isExcluded } : m))
        )
        onExcludeChange()
      }
    } finally {
      setExcludeLoading((s) => { const n = new Set(s); n.delete(matchId); return n })
    }
  }

  if (loading) {
    return (
      <div className="border-t border-black/8 bg-[#f7f6f3] px-5 py-4 text-center text-[#7a7060] text-sm">
        Henter kampe...
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="border-t border-black/8 bg-[#f7f6f3] px-5 py-4 text-center text-[#7a7060] text-sm">
        Ingen kampe i denne runde
      </div>
    )
  }

  return (
    <div className="border-t border-black/8 bg-[#f7f6f3]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider border-b border-black/8">
            <th className="text-left px-5 py-2">Kamp</th>
            <th className="text-left py-2">Dato & tid</th>
            <th className="text-center py-2">Status</th>
            <th className="text-right px-5 py-2">Handling</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const loading = excludeLoading.has(match.id)
            return (
              <tr
                key={match.id}
                className={`border-b border-black/5 ${match.is_excluded ? 'opacity-40' : ''}`}
              >
                <td className="px-5 py-2.5 font-medium text-[#1a3329]">
                  {match.home_team} vs {match.away_team}
                </td>
                <td className="py-2.5 text-[#7a7060]">
                  {new Date(match.kickoff_at).toLocaleDateString('da-DK', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-2.5 text-center">
                  <StatusBadge status={match.status} />
                </td>
                <td className="px-5 py-2.5 text-right">
                  {match.is_excluded ? (
                    <button
                      onClick={() => toggleExclude(match.id, true)}
                      disabled={loading}
                      className="text-[11px] font-semibold text-green-600 hover:text-green-800 px-3 py-1 border border-green-200 rounded-lg disabled:opacity-50"
                    >
                      Genaktivér
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleExclude(match.id, false)}
                      disabled={loading}
                      className="text-[11px] font-semibold text-orange-600 hover:text-orange-800 px-3 py-1 border border-orange-200 rounded-lg disabled:opacity-50"
                    >
                      Undtag
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LeagueOverblikCard({
  league,
  adminSecret,
}: {
  league: LeagueOverview
  adminSecret: string
}) {
  const [expandedRoundId, setExpandedRoundId] = useState<number | null>(null)

  return (
    <div className="border border-black/8 rounded-xl overflow-hidden mb-4">
      <div className="bg-[#2C4A3E] px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-['Barlow_Condensed'] text-lg font-bold text-white uppercase tracking-wide">
            {league.name}
          </h3>
          <span className="text-white/50 text-[12px]">{league.country}</span>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-white/70">
          <span>{league.activeRooms.toLocaleString('da-DK')} aktive rum</span>
          <span>{league.totalBets.toLocaleString('da-DK')} bets på aktuel runde</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-black/8 bg-white">
        {[
          { label: 'Forrige runde', round: league.previousRound },
          { label: 'Aktuel runde', round: league.currentRound, highlight: true },
          { label: 'Næste runde', round: league.nextRound },
        ].map(({ label, round, highlight }) => (
          <div
            key={label}
            className={`px-4 py-3 ${highlight ? 'bg-[#fafaf8]' : ''}`}
          >
            <p className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider mb-1">
              {label}
            </p>
            {round ? (
              <>
                <p className="font-semibold text-[14px] text-[#1a3329]">{round.name}</p>
                <p className="text-[12px] text-[#7a7060]">
                  {round.kickoff_date
                    ? new Date(round.kickoff_date).toLocaleDateString('da-DK', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'}
                </p>
                <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                  <StatusBadge status={round.status} />
                  <button
                    onClick={() =>
                      setExpandedRoundId(expandedRoundId === round.id ? null : round.id)
                    }
                    className="text-[11px] text-[#2C4A3E] hover:text-[#B8963E] font-semibold"
                  >
                    {expandedRoundId === round.id ? '↑ Skjul' : '↓ Kampe'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-[#7a7060]">—</p>
            )}
          </div>
        ))}
      </div>

      {expandedRoundId && (
        <MatchList
          roundId={expandedRoundId}
          adminSecret={adminSecret}
          onExcludeChange={() => {}}
        />
      )}
    </div>
  )
}

export function AdminOverviewTab({ adminSecret }: Props) {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [leagues, setLeagues] = useState<LeagueOverview[]>([])
  const [loading, setLoading] = useState(true)

  const authHeader = { Authorization: `Bearer ${adminSecret}` }

  useEffect(() => {
    fetch('/api/admin/status', { headers: authHeader })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    fetch('/api/admin/leagues/overview', { headers: authHeader })
      .then((r) => r.json())
      .then((d) => setLeagues(d.leagues ?? []))
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <StatusCard
          title="Cron · sync-results"
          status={status?.cron.isHealthy ? 'ok' : 'error'}
          detail={`Sidst kørt: ${formatRelative(status?.cron.lastRun ?? null)}`}
          sub={`Næste: ${formatTime(status?.cron.nextRun ?? null)}`}
        />
        <StatusCard
          title="Bold API"
          status={status?.boldApi.isHealthy ? 'ok' : 'error'}
          detail={`Seneste sync: ${formatRelative(status?.boldApi.lastSync ?? null)}`}
          sub={`Fejl seneste 24t: ${status?.boldApi.errorCount ?? 0}`}
        />
      </div>

      <div>
        <h3 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-4">
          Liga-overblik
        </h3>
        {loading ? (
          <div className="rounded-xl border border-black/8 bg-white p-8 text-center text-[#7a7060] text-sm">
            Henter...
          </div>
        ) : leagues.length === 0 ? (
          <div className="rounded-xl border border-black/8 bg-white p-8 text-center text-[#7a7060] text-sm">
            Ingen ligaer
          </div>
        ) : (
          leagues.map((league) => (
            <LeagueOverblikCard key={league.id} league={league} adminSecret={adminSecret} />
          ))
        )}
      </div>
    </div>
  )
}
