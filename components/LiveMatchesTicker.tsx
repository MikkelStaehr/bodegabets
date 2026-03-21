'use client'

import { LiveMatch, LiveSummary } from '@/hooks/useLiveMatches'
import MatchClock from '@/components/MatchClock'

function StatusBadge({ status, kickoff }: { status: LiveMatch['status']; kickoff?: string }) {
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
    <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
      {kickoff
        ? new Date(kickoff).toLocaleTimeString('da-DK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
        : '—'}
    </span>
  )
  return null
}

function getBetResult(match: LiveMatch): 'correct' | 'incorrect' | 'pending' | 'none' {
  if (!match.userPrediction) return 'none'
  if (match.status !== 'finished') return 'pending'
  if (match.home_score === null || match.away_score === null) return 'pending'
  const actual =
    match.home_score > match.away_score ? '1'
    : match.home_score === match.away_score ? 'X'
    : '2'
  return match.userPrediction === actual ? 'correct' : 'incorrect'
}

function BetBadge({ match }: { match: LiveMatch }) {
  const betResult = getBetResult(match)
  if (betResult === 'none') return null

  const bg = betResult === 'correct' ? '#27ae60'
    : betResult === 'incorrect' ? '#c0392b'
    : '#6b7280'

  return (
    <span
      className="text-[10px] font-bold text-white rounded px-1.5 py-0.5 leading-none"
      style={{ backgroundColor: bg }}
    >
      {match.userPrediction}
    </span>
  )
}

function MatchRow({ match }: { match: LiveMatch }) {
  const isLive = match.status === 'live'
  const isHalftime = match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const isScheduled = match.status === 'scheduled'

  const rowBg = isLive ? 'bg-red-500/15'
    : isHalftime ? 'bg-amber-500/15'
    : isScheduled ? 'bg-white/[0.03]'
    : 'bg-white/5'

  const betResult = getBetResult(match)
  const borderColor =
    betResult === 'correct' ? '#27ae60'
    : betResult === 'incorrect' ? '#c0392b'
    : 'transparent'

  const scoreColor = isLive ? 'text-red-500' : isHalftime ? 'text-amber-500' : 'text-[#F2EDE4]'
  const teamColor = isFinished ? 'text-[#7a7060]' : 'text-[#F2EDE4]'

  return (
    <div
      className={`flex items-center gap-2 pr-3 py-1.5 rounded-lg ${rowBg}`}
      style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: 8 }}
    >
      {/* Tournament logo */}
      {match.tournamentLogo && (
        <img
          src={match.tournamentLogo}
          alt=""
          className="shrink-0"
          style={{ width: 16, height: 16, objectFit: 'contain' }}
        />
      )}

      {/* Hjemmehold */}
      <div className="flex items-center gap-1 min-w-0" style={{ width: '35%' }}>
        {match.home_team_logo && (
          <img src={match.home_team_logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} className="shrink-0" />
        )}
        <span className={`text-[11px] truncate font-['Barlow_Condensed'] font-semibold ${teamColor}`}>
          {match.home_team}
        </span>
      </div>

      {/* Score */}
      <div className="shrink-0 w-10 text-center">
        {!isScheduled ? (
          <span className={`font-['Barlow_Condensed'] text-[13px] font-black tabular-nums ${scoreColor}`}>
            {match.home_score ?? 0}–{match.away_score ?? 0}
          </span>
        ) : (
          <span className="text-[11px] text-[#7a7060]">vs</span>
        )}
      </div>

      {/* Udehold */}
      <div className="flex items-center gap-1 min-w-0" style={{ width: '35%' }}>
        {match.away_team_logo && (
          <img src={match.away_team_logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} className="shrink-0" />
        )}
        <span className={`text-[11px] truncate font-['Barlow_Condensed'] font-semibold ${teamColor}`}>
          {match.away_team}
        </span>
      </div>

      {/* Status + Clock */}
      <div className="shrink-0 flex items-center gap-1.5 ml-auto">
        <MatchClock status={match.status} />
        <StatusBadge status={match.status} kickoff={match.kickoff_at} />
      </div>

      {/* Bet badge */}
      <div className="shrink-0 w-6 flex items-center justify-center">
        <BetBadge match={match} />
      </div>
    </div>
  )
}

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date)
  const label = d.toLocaleDateString('da-DK', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] font-bold text-[#7a7060] uppercase tracking-wider capitalize">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  )
}

function groupByDate(matches: LiveMatch[]) {
  const groups: { date: string; matches: LiveMatch[] }[] = []
  for (const m of matches) {
    const date = m.kickoff_at.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.matches.push(m)
    } else {
      groups.push({ date, matches: [m] })
    }
  }
  return groups
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

  const defaultTitle = hasLive
    ? `${summary.live + summary.halftime} kamp${summary.live + summary.halftime !== 1 ? 'e' : ''} live`
    : summary.total > 0
    ? `${summary.total} kamp${summary.total !== 1 ? 'e' : ''} i dag`
    : `${summary.finished} kamp${summary.finished !== 1 ? 'e' : ''} afsluttet`

  const defaultRight = lastUpdate ? (
    <span className="text-[9px] text-[#7a7060]">
      Opdateret {lastUpdate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  ) : null

  const displayMatches = maxMatches ? matches.slice(0, maxMatches) : matches
  const dateGroups = groupByDate(displayMatches)
  const showDateSeparators = dateGroups.length > 1

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          {hasLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          {headerTitle ?? (
            <span className="text-[11px] font-bold text-[#F2EDE4] uppercase tracking-wider">
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
        {dateGroups.map((group) => (
          <div key={group.date}>
            {showDateSeparators && <DateSeparator date={group.date} />}
            {group.matches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
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
