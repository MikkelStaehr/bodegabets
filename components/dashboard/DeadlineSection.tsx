'use client'

import Link from 'next/link'
import { useDeadlines, type DeadlineItem } from '@/hooks/useDeadlines'

function formatDeadline(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function DeadlineRow({ d }: { d: DeadlineItem }) {
  const isOpen = d.deadline_status === 'open'
  const isClosed = d.deadline_status === 'closed'

  return (
    <Link
      href={`/games/${d.game_id}`}
      className={`block px-3 py-2.5 rounded-lg border transition-colors
        ${isOpen ? 'border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/12' : 'border-black/8 bg-white/50 hover:bg-black/4'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#1a3329] truncate">{d.game_name}</p>
          <p className="text-[11px] text-[#7a7060] mt-0.5">{d.round_name} · {d.league_name}</p>
        </div>
        <div className="shrink-0 text-right">
          {d.betting_closes_at && (
            <p className={`text-[11px] font-medium ${isOpen ? 'text-amber-600' : 'text-[#7a7060]'}`}>
              {formatDeadline(d.betting_closes_at)}
            </p>
          )}
          <span
            className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded
              ${isOpen ? (d.bets_submitted ? 'bg-green-500/20 text-green-700' : 'bg-amber-500/25 text-amber-700')
                : isClosed ? 'bg-black/8 text-[#7a7060]' : 'bg-black/8 text-[#7a7060]'}`}
          >
            {isOpen ? (d.bets_submitted ? 'Afgivet' : 'Afgå') : isClosed ? 'Lukket' : 'Kommende'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function DeadlineSection() {
  const { deadlines } = useDeadlines(true)

  const open = deadlines.filter((d) => d.deadline_status === 'open')
  const closed = deadlines.filter((d) => d.deadline_status === 'closed')
  const upcoming = deadlines.filter((d) => d.deadline_status === 'upcoming')

  if (deadlines.length === 0) return null

  return (
    <div>
      <h2 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-3">Bet-deadlines</h2>
      <div className="flex flex-col gap-2">
        {open.map((d) => (
          <DeadlineRow key={`${d.game_id}-${d.round_name}`} d={d} />
        ))}
        {upcoming.slice(0, 3).map((d) => (
          <DeadlineRow key={`${d.game_id}-${d.round_name}`} d={d} />
        ))}
        {closed.slice(0, 2).map((d) => (
          <DeadlineRow key={`${d.game_id}-${d.round_name}`} d={d} />
        ))}
      </div>
    </div>
  )
}
