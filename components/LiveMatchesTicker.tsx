'use client'

import { LiveMatch, LiveSummary } from '@/hooks/useLiveMatches'

function StatusBadge({ status }: { status: LiveMatch['status'] }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Live</span>
    </span>
  )
  if (status === 'halftime') return (
    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">HT</span>
  )
  if (status === 'finished') return (
    <span className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wide">Slut</span>
  )
  if (status === 'scheduled') return (
    <span className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wide">Kommende</span>
  )
  return null
}

function MatchRow({ match }: { match: LiveMatch }) {
  const isLive = match.status === 'live'
  const isHalftime = match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const isScheduled = match.status === 'scheduled'

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg
      ${isLive ? 'bg-red-500/8' : isHalftime ? 'bg-amber-500/8' : isScheduled ? 'bg-black/4' : 'bg-black/4'}`}
    >
      {/* Hold + score */}
      <div className="flex-1 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[12px] truncate font-['Barlow_Condensed'] font-semibold
            ${isFinished ? 'text-[#7a7060]' : 'text-[#1a3329]'}`}
          >
            {match.home_team}
          </span>
          <span
            className={`font-['Barlow_Condensed'] text-[15px] font-black tabular-nums
            ${isLive ? 'text-red-600' : isHalftime ? 'text-amber-600' : 'text-[#1a3329]'}`}
          >
            {isScheduled ? '–' : `${match.home_score ?? 0}–${match.away_score ?? 0}`}
          </span>
          <span
            className={`text-[12px] truncate font-['Barlow_Condensed'] font-semibold
            ${isFinished ? 'text-[#7a7060]' : 'text-[#1a3329]'}`}
          >
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={match.status} />
      </div>
    </div>
  )
}

export function LiveMatchesTicker({
  matches,
  summary,
  lastUpdate,
  compact = false,
  headerAction,
  headerTitle,
  headerRight,
  maxMatches,
}: {
  matches: LiveMatch[]
  summary: LiveSummary
  lastUpdate: Date | null
  compact?: boolean
  headerAction?: React.ReactNode
  headerTitle?: React.ReactNode
  headerRight?: React.ReactNode
  maxMatches?: number
}) {
  if (matches.length === 0) return null

  const hasLive = summary.live > 0 || summary.halftime > 0
  const liveCount = summary.live + summary.halftime
  const scheduledCount = summary.scheduled ?? 0

  const defaultTitle = hasLive
    ? `${liveCount} kamp${liveCount !== 1 ? 'e' : ''} live`
    : summary.finished > 0
      ? `${summary.finished} kamp${summary.finished !== 1 ? 'e' : ''} afsluttet`
      : scheduledCount > 0
        ? `${scheduledCount} kommende kamp${scheduledCount !== 1 ? 'e' : ''}`
        : `${summary.total} kamp${summary.total !== 1 ? 'e' : ''}`

  const defaultRight = lastUpdate ? (
    <span className="text-[9px] text-[#7a7060]">
      Opdateret {lastUpdate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  ) : null

  return (
    <div
      className={`rounded-xl border overflow-hidden
      ${hasLive ? 'border-red-500/20 bg-red-500/5' : 'border-black/10 bg-white'}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b
        ${hasLive ? 'border-red-500/15' : 'border-black/8'}`}
      >
        <div className="flex items-center gap-2">
          {hasLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          {headerTitle ?? (
            <span className="text-[11px] font-bold text-[#1a3329] uppercase tracking-wider">
              {defaultTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerRight ?? defaultRight}
          {headerAction}
        </div>
      </div>

      {/* Kampe */}
      <div
        className={`flex flex-col gap-0.5 p-1.5 ${compact ? 'max-h-[160px]' : 'max-h-[300px]'} overflow-y-auto`}
      >
        {(maxMatches ? matches.slice(0, maxMatches) : matches).map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
        {maxMatches && matches.length > maxMatches && (
          <div className="px-3 py-2 text-center text-xs text-[#7a7060] font-body">
            +{matches.length - maxMatches} flere kampe
          </div>
        )}
      </div>
    </div>
  )
}
