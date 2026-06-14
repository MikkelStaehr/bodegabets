'use client'

import { LiveMatch, LiveSummary } from '@/hooks/useLiveMatches'
import { isBetCorrect } from '@/lib/betUtils'

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
    <span className="text-[10px] font-bold text-[var(--color-warm-taupe)] uppercase tracking-wide">Slut</span>
  )
  if (status === 'scheduled') return (
    <span className="font-condensed text-[12px] font-bold text-gray-400">
      {kickoff
        ? new Date(kickoff).toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' })
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

  const bg = betResult === 'correct' ? 'var(--color-green-dark)'
    : betResult === 'incorrect' ? 'var(--color-red-dark)'
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
  const isRivalry = match.isRivalry === true

  const rowBg = isLive ? 'bg-red-500/15'
    : isHalftime ? 'bg-amber-500/15'
    : isRivalry ? 'bg-[var(--color-card-green)]/25'
    : isScheduled ? 'bg-white/[0.03]'
    : 'bg-white/5'

  const betResult = getBetResult(match)
  const borderColor =
    betResult === 'correct' ? 'var(--color-green-dark)'
    : betResult === 'incorrect' ? 'var(--color-red-dark)'
    : 'transparent'

  const scoreColor = isLive ? 'text-red-500' : isHalftime ? 'text-amber-500' : 'text-[var(--color-cream)]'
  const teamColor = isFinished ? 'text-[var(--color-warm-taupe)]' : 'text-[var(--color-cream)]'

  const showDistribution = match.bet_open === false && match.distribution && match.distribution.total > 0

  return (
    <div className={`rounded-sm ${rowBg}`} style={{ borderLeft: `3px solid ${borderColor}` }}>
      {isRivalry && match.rivalryName && (
        <div className="flex items-center gap-1 px-2 pt-1.5 pb-0.5">
          <span className="font-condensed text-[9px] font-bold text-[var(--color-gold-muted)] tracking-[0.1em] uppercase">
            🔥 {match.rivalryName}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 pr-3 py-1.5 pl-2">
        {/* Tournament logo */}
        {match.tournamentLogo && (
          <img
            src={match.tournamentLogo}
            alt=""
            className="shrink-0 w-4 h-4 object-contain"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.5 }}
          />
        )}

        {/* Hjemmehold */}
        <div className="flex items-center gap-1 min-w-0 w-[35%]">
          {match.home_team_logo && (
            <img src={match.home_team_logo} alt="" className="shrink-0 w-3.5 h-3.5 object-contain" />
          )}
          <span className={`text-[11px] truncate font-condensed font-semibold ${teamColor}`}>
            {match.home_team}
          </span>
        </div>

        {/* Score */}
        <div className="shrink-0 w-10 text-center">
          {!isScheduled ? (
            <span className={`font-condensed text-[13px] font-black tabular-nums ${scoreColor}`}>
              {match.home_score ?? 0}–{match.away_score ?? 0}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--color-warm-taupe)]">vs</span>
          )}
        </div>

        {/* Udehold */}
        <div className="flex items-center gap-1 min-w-0 w-[35%]">
          {match.away_team_logo && (
            <img src={match.away_team_logo} alt="" className="shrink-0 w-3.5 h-3.5 object-contain" />
          )}
          <span className={`text-[11px] truncate font-condensed font-semibold ${teamColor}`}>
            {match.away_team}
          </span>
        </div>

        {/* Status */}
        <div className="shrink-0 flex items-center gap-1.5 ml-auto">
          <StatusBadge status={match.status} kickoff={match.kickoff_at} />
        </div>

        {/* Bet badge */}
        <div className="shrink-0 w-6 flex items-center justify-center">
          <BetBadge match={match} />
        </div>
      </div>

      {/* Bet fordeling — kun på låste kampe */}
      {showDistribution && (
        <div className="flex gap-1 items-center px-3 pb-1.5 border-t border-white/[0.06]">
          {(['1', 'X', '2'] as const).map((opt) => {
            const count = match.distribution![opt] ?? 0
            const pct = match.distribution!.total > 0 ? Math.round((count / match.distribution!.total) * 100) : 0
            const isHighest = count === Math.max(match.distribution!['1'], match.distribution!['X'], match.distribution!['2'])
            const odds = match.distribution!.odds?.[opt] ?? null
            return (
              <div key={opt} className="flex-1 text-center">
                <div className="font-condensed text-[10px] text-[var(--color-cream)]/40 font-bold uppercase">
                  {opt}
                </div>
                {odds !== null && (
                  <div className="font-condensed text-[11px] text-[var(--color-cream)]/40">
                    {odds.toFixed(2)}
                  </div>
                )}
                <div className={`font-condensed text-[13px] font-bold ${isHighest && pct > 0 ? 'text-gold' : 'text-[var(--color-cream)]/50'}`}>
                  {pct}%
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ekstra bets — brugerens egne, vises med det samme. Odds + fordeling
          (extraBetDist) findes kun for låste kampe og rendrer betinget nedenfor,
          så det "blinde" element bevares indtil deadline. */}
      {match.userExtraPicks && Object.keys(match.userExtraPicks).length > 0 && (
        <div className="px-3 pb-2 flex flex-col gap-1 border-t border-white/10 pt-2">
          {([
            { key: 'goals_3plus', label: 'Mål 3+' },
            { key: 'clean_sheet', label: 'Clean sheet' },
            { key: 'win_margin', label: 'Sejr margin' },
          ] as const).map((row) => {
            const userPick = match.userExtraPicks?.[row.key]
            if (!userPick) return null
            const teamName = userPick === '1' ? match.home_team : match.away_team
            const resultIcon = match.status !== 'finished' ? '—' : null
            let finishedIcon: string | null = null
            let finishedColor = 'text-[var(--color-cream)]/40'
            if (match.status === 'finished' && match.home_score != null && match.away_score != null) {
              const correct = isBetCorrect(row.key, userPick, match.home_score, match.away_score)
              finishedIcon = correct ? '✓' : '✗'
              finishedColor = correct ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
            }
            const dist = match.extraBetDist?.[row.key]
            const odds = dist ? (userPick === '1' ? dist.odds_1 : dist.odds_2) : null
            const betCount = dist ? (userPick === '1' ? dist.count_1 : dist.count_2) : null
            return (
              <div key={row.key} className="flex items-center gap-2 py-1">
                <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--color-gold-muted)] w-[72px] shrink-0">
                  {row.label}
                </span>
                <span className="text-[10px] font-medium text-[var(--color-cream)] truncate flex-1">
                  {teamName} ({userPick})
                </span>
                {odds != null && (
                  <span className="text-[9px] font-bold text-[var(--color-muted)] shrink-0">{odds.toFixed(2)}</span>
                )}
                {betCount != null && (
                  <span className="text-[9px] text-[var(--color-muted)] shrink-0">{betCount} {betCount === 1 ? 'bet' : 'bets'}</span>
                )}
                <span className={`text-[13px] font-bold shrink-0 w-5 text-center ${finishedIcon ? finishedColor : 'text-[var(--color-cream)]/30'}`}>
                  {finishedIcon ?? resultIcon}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date)
  const label = d.toLocaleDateString('da-DK', {
    timeZone: 'Europe/Copenhagen',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] font-bold text-[var(--color-warm-taupe)] uppercase tracking-wider capitalize">
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
  const liveCount = summary.live + summary.halftime
  const plural = liveCount !== 1 ? 'e' : ''

  const defaultTitle = hasLive
    ? `${liveCount} kamp${plural} live`
    : summary.roundName ?? 'Ingen kommende kampe'

  const defaultRight = lastUpdate ? (
    <span className="text-[9px] text-[var(--color-warm-taupe)]">
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
            <span className="text-[11px] font-bold text-[var(--color-cream)] uppercase tracking-wider">
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
          <div className="px-3 py-2 text-center text-xs text-[var(--color-warm-taupe)] font-body">
            +{matches.length - maxMatches} flere kampe
          </div>
        )}
      </div>
    </div>
  )
}
