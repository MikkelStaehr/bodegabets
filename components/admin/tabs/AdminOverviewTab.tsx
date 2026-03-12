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
      className={`border p-4 flex items-start gap-3 ${
        status === 'ok' ? 'border-forest/30 bg-forest/10' : 'border-vintage-red/30 bg-vintage-red/10'
      }`}
      style={{ borderRadius: '2px' }}
    >
      <div
        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
          status === 'ok' ? 'bg-forest' : 'bg-vintage-red animate-pulse'
        }`}
      />
      <div className="min-w-0">
        <p className="font-condensed text-[12px] font-bold text-ink uppercase tracking-wide">{title}</p>
        <p className="font-body text-[13px] text-ink mt-0.5">{detail}</p>
        <p className="font-body text-[11px] text-warm-gray mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'text-gold bg-gold/10 border-gold/30',
  open: 'text-forest bg-forest/10 border-forest/30',
  closed: 'text-vintage-red/80 bg-vintage-red/10 border-vintage-red/30',
  finished: 'text-warm-gray bg-cream-dark border-warm-border',
  scheduled: 'text-warm-gray bg-cream-dark border-warm-border',
  live: 'text-vintage-red bg-vintage-red/10 border-vintage-red/30',
  halftime: 'text-gold bg-gold/10 border-gold/30',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`font-condensed text-xs uppercase tracking-wide border px-2 py-0.5 ${STATUS_COLORS[status] ?? 'bg-cream-dark text-warm-gray border-warm-border'}`}
      style={{ borderRadius: '2px' }}
    >
      {status}
    </span>
  )
}

function MatchList({
  roundId,
  adminSecret,
}: {
  roundId: number
  adminSecret: string
  onExcludeChange?: () => void
}) {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="border-t border-warm-border bg-cream-dark px-5 py-4 text-center font-body text-warm-gray text-sm">
        Henter kampe...
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="border-t border-warm-border bg-cream-dark px-5 py-4 text-center font-body text-warm-gray text-sm">
        Ingen kampe i denne runde
      </div>
    )
  }

  return (
    <div className="border-t border-warm-border bg-cream-dark">
      <table className="w-full font-body text-[13px]">
        <thead>
          <tr className="font-condensed text-[10px] font-bold text-warm-gray uppercase tracking-wider border-b border-warm-border">
            <th className="text-left px-5 py-2">Kamp</th>
            <th className="text-left py-2">Dato & tid</th>
            <th className="text-center py-2">Status</th>
            <th className="text-right px-5 py-2">Handling</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
              <tr
                key={match.id}
                className="border-b border-warm-border"
              >
                <td className="px-5 py-2.5 font-medium text-ink">
                  {match.home_team} vs {match.away_team}
                </td>
                <td className="py-2.5 text-warm-gray">
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
                <td className="px-5 py-2.5 text-right" />
              </tr>
          ))}
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
    <div className="border border-warm-border overflow-hidden mb-4" style={{ borderRadius: '2px' }}>
      <div className="bg-forest px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-condensed text-lg font-bold text-cream uppercase tracking-wide">
            {league.name}
          </h3>
          <span className="text-cream/50 font-body text-[12px]">{league.country}</span>
        </div>
        <div className="flex items-center gap-4 font-body text-[12px] text-cream/70">
          <span>{league.activeRooms.toLocaleString('da-DK')} aktive rum</span>
          <span>{league.totalBets.toLocaleString('da-DK')} bets på aktuel runde</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-warm-border bg-cream">
        {[
          { label: 'Forrige runde', round: league.previousRound },
          { label: 'Aktuel runde', round: league.currentRound, highlight: true },
          { label: 'Næste runde', round: league.nextRound },
        ].map(({ label, round, highlight }) => (
          <div
            key={label}
            className={`px-4 py-3 ${highlight ? 'bg-cream-dark' : ''}`}
          >
            <p className="font-condensed text-[10px] font-bold text-warm-gray uppercase tracking-wider mb-1">
              {label}
            </p>
            {round ? (
              <>
                <p className="font-condensed font-semibold text-[14px] text-ink">{round.name}</p>
                <p className="font-body text-[12px] text-warm-gray">
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
                    className="font-condensed text-[11px] text-forest hover:text-gold font-semibold"
                  >
                    {expandedRoundId === round.id ? '↑ Skjul' : '↓ Kampe'}
                  </button>
                </div>
              </>
            ) : (
              <p className="font-body text-[12px] text-warm-gray">—</p>
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
  const router = useRouter()
  const [status, setStatus] = useState<StatusData | null>(null)
  const [leagues, setLeagues] = useState<LeagueOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [cronLoading, setCronLoading] = useState<Set<string>>(new Set())
  const [cronMessages, setCronMessages] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({})

  const authHeader = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSecret}` }

  function setCronMsg(key: string, type: 'ok' | 'err', text: string) {
    setCronMessages((prev) => ({ ...prev, [key]: { type, text } }))
    setTimeout(() => {
      setCronMessages((prev) => {
        const n = { ...prev }
        delete n[key]
        return n
      })
    }, 5000)
  }

  async function runCron(cron: string) {
    setCronLoading((s) => new Set(s).add(cron))
    try {
      const res = await fetch('/api/admin/run-cron', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ cron }),
      })
      const data = await res.json()
      if (data.ok) {
        setCronMsg(cron, 'ok', 'Cron gennemført')
        router.refresh()
      } else {
        setCronMsg(cron, 'err', data.error || 'Cron fejlede')
      }
    } catch {
      setCronMsg(cron, 'err', 'Netværksfejl')
    } finally {
      setCronLoading((s) => {
        const n = new Set(s)
        n.delete(cron)
        return n
      })
    }
  }

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
      {/* Cron jobs */}
      <div className="border border-warm-border bg-cream p-5 mb-8" style={{ borderRadius: '2px' }}>
        <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>System</p>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">Cron jobs</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'sync-fixtures', label: 'Sync fixtures' },
            { key: 'sync-scores', label: 'Sync scores' },
            { key: 'update-rounds', label: 'Opdater runder' },
            { key: 'calculate-points', label: 'Beregn point' },
          ].map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <button
                onClick={() => runCron(key)}
                disabled={cronLoading.has(key)}
                className="inline-flex items-center gap-1.5 font-condensed text-[12px] font-semibold text-forest px-4 py-2 border border-warm-border hover:bg-cream-dark disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: '2px' }}
              >
                {cronLoading.has(key) && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {label}
              </button>
              {cronMessages[key] && (
                <span
                  className={`font-body text-[11px] ${
                    cronMessages[key].type === 'ok' ? 'text-forest' : 'text-vintage-red'
                  }`}
                >
                  {cronMessages[key].text}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

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
        <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Ligaer</p>
        <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">Liga-overblik</h2>
        {loading ? (
          <div className="border border-warm-border bg-cream p-8 text-center font-body text-warm-gray text-sm" style={{ borderRadius: '2px' }}>
            Henter...
          </div>
        ) : leagues.length === 0 ? (
          <div className="border border-warm-border bg-cream p-8 text-center font-body text-warm-gray text-sm" style={{ borderRadius: '2px' }}>
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
