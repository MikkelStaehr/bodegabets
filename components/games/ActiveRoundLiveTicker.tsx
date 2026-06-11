'use client'

import { useGameStateContextOptional } from '@/hooks/useGameState'
import { LiveMatchesTicker } from '@/components/games/LiveMatchesTicker'
import type { LiveMatch, LiveSummary } from '@/hooks/useLiveMatches'
import { useCalendarSelection } from '@/components/games/CalendarSelectionContext'
import type { CalendarMatch } from '@/components/games/CalendarSlider'

// Konvertér en kalender-kamp til live-ticker-formatet, så de valgte dags
// kampe vises præcis som live-kampene (flag, score/tid, status). Ingen odds/
// bets på fremtidige kampe — de felter er bevidst tomme.
function toTickerMatch(m: CalendarMatch): LiveMatch {
  return {
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
    home_team_logo: m.home_team_logo ?? null,
    away_team_logo: m.away_team_logo ?? null,
    home_score: m.home_score,
    away_score: m.away_score,
    status: m.status,
    kickoff_at: m.kickoff_at,
    tournamentLogo: null,
    userPrediction: null,
    bet_open: m.status === 'scheduled',
    distribution: null,
    isRivalry: m.isRivalry ?? false,
    rivalryName: null,
  } as unknown as LiveMatch
}

function dateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`)
  return d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function ActiveRoundLiveTicker() {
  const ctx = useGameStateContextOptional()
  const matches = (ctx?.state?.matches ?? []) as unknown as LiveMatch[]
  const summary: LiveSummary = ctx?.state?.summary ?? {
    live: 0, halftime: 0, finished: 0, scheduled: 0, total: 0, roundName: null,
  }
  const lastUpdate = ctx?.lastUpdate ?? null
  const isLoading = ctx?.isLoading ?? true

  // Valgt kalender-dato (≠ i dag) med kampe → vises under live-kampene.
  const sel = useCalendarSelection()
  const picked = sel?.selection && !sel.selection.isToday && sel.selection.matches.length > 0
    ? sel.selection
    : null
  const pickedMatches = picked ? picked.matches.map(toTickerMatch) : []
  const pickedSummary: LiveSummary = {
    live: 0, halftime: 0,
    finished: pickedMatches.filter((m) => m.status === 'finished').length,
    scheduled: pickedMatches.filter((m) => m.status === 'scheduled').length,
    total: pickedMatches.length, roundName: null,
  }

  if (isLoading) {
    return (
      <div className="bg-[#1a3329] rounded-xl overflow-hidden" style={{ marginTop: 16 }}>
        <div className="px-4 py-3 flex justify-between items-center border-b border-white/10">
          <div className="h-4 w-32 rounded bg-[#2C4A3E] animate-pulse" />
          <div className="h-3 w-20 rounded bg-[#2C4A3E] animate-pulse" />
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="h-3 w-24 rounded bg-[#2C4A3E] animate-pulse mx-auto" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
              <div className="h-4 rounded bg-[#2C4A3E] animate-pulse flex-1" />
              <div className="h-3 w-8 rounded bg-[#2C4A3E] animate-pulse" />
              <div className="h-4 rounded bg-[#2C4A3E] animate-pulse flex-1" />
              <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
              <div className="h-5 w-6 rounded bg-[#2C4A3E] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const hasLive = matches.length > 0

  // Hverken live-kampe i dag eller en valgt dato → behold den enkle besked.
  if (!hasLive && !picked) return (
    <div style={{
      marginTop: 16,
      background: '#1a3329',
      borderRadius: 8,
      padding: '16px 20px',
      border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(242,237,228,0.4)',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 12,
      textAlign: 'center' as const,
    }}>
      Ingen kampe i dag
    </div>
  )

  return (
    <div style={{
      marginTop: 16,
      background: '#1a3329',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {hasLive && (
        <LiveMatchesTicker
          matches={matches}
          summary={summary}
          lastUpdate={lastUpdate}
        />
      )}

      {/* Valgt kalender-dato — vist under live-kampene, adskilt med en kraftig
          linje, så man kan se kampene på en fremtidig (eller tidligere) dag. */}
      {picked && (
        <>
          {hasLive && <div style={{ height: 3, background: 'rgba(0,0,0,0.25)' }} />}
          <LiveMatchesTicker
            matches={pickedMatches}
            summary={pickedSummary}
            lastUpdate={null}
            headerTitle={
              <span className="text-[11px] font-bold uppercase tracking-wider capitalize" style={{ color: '#F2EDE4' }}>
                {dateLabel(picked.dateKey)}
              </span>
            }
          />
        </>
      )}
    </div>
  )
}
