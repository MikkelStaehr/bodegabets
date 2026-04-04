import Link from 'next/link'
import type { SportType } from './DashboardContent'

type GameRow = {
  points: number
  rank: number
  bets_count: number
  game: {
    id: number
    name: string
    status: string
    invite_code: string
    member_count: number
    league_name: string | null
    sport_type: SportType
  }
  activeRound: {
    id: number
    name: string
    betting_closes_at: string | null
    matches_count: number
    round_status: 'upcoming' | 'active' | 'finished' | null
  } | null
}

const SPORT_EMOJI: Record<SportType, string> = {
  football: '⚽',
  cycling: '🚴',
}

type Top3Entry = { user_id: string; username: string; earnings: number }

export default function DashboardGameCard({ row, logoUrls, leagueNames, top3, activeBlock }: { row: GameRow; logoUrls?: string[]; leagueNames?: string[]; top3?: Top3Entry[]; activeBlock?: { block_number: number; name: string; rounds_remaining: number } | null }) {
  const { game, points, rank, bets_count, activeRound } = row
  const hasBets = bets_count > 0
  const deadline = activeRound?.betting_closes_at ? new Date(activeRound.betting_closes_at) : null
  const deadlineStr = deadline
    ? deadline.toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const isDeadlineSoon = deadline ? deadline.getTime() - Date.now() < 6 * 60 * 60 * 1000 : false
  const isFinished = game.status === 'finished'

  const badge = (() => {
    if (isFinished) return { label: 'Afsluttet', style: 'bg-white/20 text-white/80' }
    if (!activeRound) return { label: 'Aktiv', useAccent: true }
    if (activeRound.round_status === 'upcoming') {
      return { label: 'Kommende', style: 'bg-[#7a7060]/20 text-[#7a7060]' }
    }
    if (activeRound.round_status === 'active' && !hasBets) {
      return { label: 'Afgiv bets', style: 'bg-red-900/30 text-red-300' }
    }
    return { label: 'Aktiv', useAccent: true }
  })()

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow ${
        isFinished ? 'border-black/6' : 'border-black/8'
      }`}
    >
      {/* Top — sport badge + name + status */}
      <div className="bg-[#2C4A3E] px-5 py-4">
        {/* Sport + league badge */}
        {logoUrls && logoUrls.length > 0 ? (
          <div className="flex items-center gap-1.5 mb-2">
            {logoUrls.slice(0, 3).map((url, i) => (
              <img key={i} src={url} alt="" title={leagueNames?.[i] ?? ''} className="w-5 h-5 object-contain" />
            ))}
          </div>
        ) : game.league_name ? (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px]">{SPORT_EMOJI[game.sport_type]}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-['Barlow_Condensed'] text-lg font-bold text-white uppercase tracking-wide">
              {game.name}
            </h3>
            {activeRound && (
              <p className="text-[11px] text-white/60 mt-0.5">
                {activeRound.name} · {activeRound.matches_count} kampe
              </p>
            )}
            {activeBlock && (
              <p className="font-['Barlow_Condensed'] text-[11px] mt-0.5" style={{ color: '#9E9486' }}>
                {activeBlock.name} · {activeBlock.rounds_remaining} runde{activeBlock.rounds_remaining !== 1 ? 'r' : ''} tilbage
              </p>
            )}
          </div>
          {'useAccent' in badge ? (
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide transition-colors duration-300"
              style={{
                background: 'var(--accent-light)',
                color: 'var(--accent)',
              }}
            >
              {badge.label}
            </span>
          ) : (
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${badge.style}`}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>

      {/* Stats grid — 2x2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-3 divide-x divide-black/8 border-b border-black/8">
        {[
          { label: 'Placering', value: `#${rank}`, isRank1: rank === 1 },
          { label: 'Point', value: points.toLocaleString('da-DK') },
          { label: 'Spillere', value: String(game.member_count) },
        ].map(({ label, value, isRank1 }) => (
          <div key={label} className="px-4 py-3 text-center" style={{ minHeight: '44px' }}>
            <p className="text-[9px] font-semibold text-[#7a7060] uppercase tracking-wider mb-0.5">{label}</p>
            <p
              className="font-['Barlow_Condensed'] text-[15px] font-bold transition-colors duration-300"
              style={{ color: isRank1 ? 'var(--accent)' : '#1a3329' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Deadline + bet-status */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ minHeight: '44px' }}>
        <div className="flex items-center gap-2">
          {activeRound && !isFinished && (
            <>
              {hasBets ? (
                <span className="flex items-center gap-1.5 text-[12px] text-green-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Bets afgivet
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors duration-300" style={{ color: 'var(--accent)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-300" style={{ background: 'var(--accent)' }} />
                  {isDeadlineSoon ? 'Deadline snart!' : 'Afgiv bets'}
                </span>
              )}
              {deadlineStr && <span className="text-[11px] text-[#7a7060]">· {deadlineStr}</span>}
            </>
          )}
        </div>
        <Link
          href={`/games/${game.id}`}
          className="text-[12px] font-semibold transition-colors duration-300 flex items-center gap-1"
          style={{ color: 'var(--accent)' }}
        >
          Gå til spilrum ›
        </Link>
      </div>

      {/* Top 3 leaderboard */}
      {top3 && top3.length > 0 && (
        <div className="px-5 py-3 border-t border-black/8">
          <p className="text-[9px] font-bold text-[#7a7060] uppercase tracking-wider mb-2">Top spillere</p>
          {top3.map((member, i) => (
            <div key={member.user_id} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#7a7060] w-4">#{i + 1}</span>
                <span className="text-[12px] text-[#1a3329]">{member.username}</span>
              </div>
              <span className="text-[12px] font-bold text-[#1a3329]">
                {member.earnings.toLocaleString('da-DK')} pt
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
