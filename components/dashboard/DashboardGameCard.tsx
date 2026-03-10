import Link from 'next/link'

type GameRow = {
  points: number
  rank: number
  bets_count: number
  game: { id: number; name: string; description: string | null; status: string; invite_code: string; member_count: number }
  activeRound: {
    id: number
    name: string
    betting_closes_at: string | null
    matches_count: number
    round_status: 'upcoming' | 'active' | 'finished' | null
  } | null
}

export default function DashboardGameCard({ row }: { row: GameRow }) {
  const { game, points, rank, bets_count, activeRound } = row
  const hasBets = bets_count > 0
  // Deadline kommer fra current_rounds.first_kickoff (betting_closes_at er NULL indtil bruger sætter det)
  const deadline = activeRound?.betting_closes_at ? new Date(activeRound.betting_closes_at) : null
  const deadlineStr = deadline
    ? deadline.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const isDeadlineSoon = deadline ? deadline.getTime() - Date.now() < 6 * 60 * 60 * 1000 : false
  const isFinished = game.status === 'finished' // game-niveau: spilrum afsluttet
  // Badge: kombiner round_status (fra current_rounds) med bets_count
  const badge = (() => {
    if (isFinished) return { label: 'Afsluttet', style: 'bg-white/20 text-white/80' }
    if (!activeRound) return { label: 'Aktiv', style: 'bg-[#B8963E]/20 text-[#B8963E]' }
    if (activeRound.round_status === 'upcoming') {
      return { label: 'Kommende', style: 'bg-[#7a7060]/20 text-[#7a7060]' }
    }
    if (activeRound.round_status === 'active' && !hasBets) {
      return { label: 'Afgiv bets', style: 'bg-red-900/30 text-red-300' }
    }
    if (activeRound.round_status === 'active' && hasBets) {
      return { label: 'Aktiv', style: 'bg-[#B8963E]/20 text-[#B8963E]' }
    }
    return { label: 'Aktiv', style: 'bg-[#B8963E]/20 text-[#B8963E]' }
  })()

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow ${
        isFinished ? 'border-black/6' : 'border-black/8'
      }`}
    >
      {/* Top — navn + status */}
      <div className="bg-[#2C4A3E] px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="font-['Barlow_Condensed'] text-lg font-bold text-white uppercase tracking-wide">
            {game.name}
          </h3>
          {activeRound && (
            <p className="text-[11px] text-white/60 mt-0.5">
              {activeRound.name} · {activeRound.matches_count} kampe
            </p>
          )}
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${badge.style}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Stats-række */}
      <div className="grid grid-cols-4 divide-x divide-black/8 border-b border-black/8">
        {[
          { label: 'Placering', value: `#${rank}` },
          { label: 'Point', value: points.toLocaleString('da-DK') },
          { label: 'Spillere', value: String(game.member_count) },
          { label: 'Kode', value: game.invite_code },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-[9px] font-semibold text-[#7a7060] uppercase tracking-wider mb-0.5">{label}</p>
            <p className="font-['Barlow_Condensed'] text-[15px] font-bold text-[#1a3329]">{value}</p>
          </div>
        ))}
      </div>

      {/* Deadline + bet-status */}
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeRound && !isFinished && (
            <>
              {hasBets ? (
                <span className="flex items-center gap-1.5 text-[12px] text-green-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Bets afgivet
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[12px] text-[#B8963E] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8963E] animate-pulse" />
                  {isDeadlineSoon ? 'Deadline snart!' : 'Afgiv bets'}
                </span>
              )}
              {deadlineStr && <span className="text-[11px] text-[#7a7060]">· {deadlineStr}</span>}
            </>
          )}
        </div>
        <Link
          href={`/games/${game.id}`}
          className="text-[12px] font-semibold text-[#2C4A3E] hover:text-[#B8963E] transition-colors flex items-center gap-1"
        >
          Gå til spilrum ›
        </Link>
      </div>
    </div>
  )
}
