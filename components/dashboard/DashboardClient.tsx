'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

type Game = {
  id: number
  name: string
  status: string
  invite_code: string
  league_name: string
  rank: number | null
  member_count: number
  active_round: {
    id: number
    name: string
    status: string
    betting_closes_at: string | null
    bets_submitted?: boolean
  } | null
}

export default function DashboardClient({ displayName, games }: { displayName: string; games: Game[] }) {
  const [liveLeagues, setLiveLeagues] = useState<{ league_id: number; league_name: string; matches: { id: number; home_team: string; away_team: string; home_score: number | null; away_score: number | null; status: string; kickoff_at: string; bet?: { prediction: string; result: string | null } }[] }[]>([])
  const [deadlines, setDeadlines] = useState<{ game_id: number; game_name: string; round_name: string; betting_closes_at: string | null; bets_submitted: boolean }[]>([])
  const [sportFilter, setSportFilter] = useState<'alle' | 'fodbold' | 'cykling'>('alle')
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/users/me/live-matches').then((r) => r.json()).then((d) => setLiveLeagues(d.leagues ?? []))
    fetch('/api/users/me/deadlines').then((r) => r.json()).then((d) => setDeadlines(d.deadlines ?? []))
  }, [])

  const now = new Date()

  function deadlineLabel(dl: { betting_closes_at?: string | null; bets_submitted?: boolean }) {
    const closes = dl.betting_closes_at ? new Date(dl.betting_closes_at) : null
    if (!closes) return { text: 'Ingen deadline', color: '#8C8C78', dot: '#8C8C78' }
    if (closes < now) {
      return dl.bets_submitted
        ? { text: 'Afgivet ✓', color: '#2C7A50', dot: '#2C7A50' }
        : { text: 'Lukket', color: '#8C8C78', dot: '#8C8C78' }
    }
    const diffH = Math.round((closes.getTime() - now.getTime()) / 36e5)
    const label = diffH < 24
      ? `Luk om ${diffH}t`
      : `Luk ${closes.toLocaleDateString('da-DK', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
    return { text: label, color: '#C0392B', dot: '#C0392B' }
  }

  function isGameDark(game: Game) {
    const round = game.active_round
    if (!round) return false
    const closes = round.betting_closes_at ? new Date(round.betting_closes_at) : null
    return !closes || closes > now
  }

  function inferSport(leagueName: string): 'fodbold' | 'cykling' {
    const lower = leagueName.toLowerCase()
    if (lower.includes('tour de france') || lower.includes('giro') || lower.includes('vuelta') || lower.includes('cykling') || lower.includes('cycling')) {
      return 'cykling'
    }
    return 'fodbold'
  }

  const filteredGames = sportFilter === 'alle'
    ? games
    : games.filter((g) => inferSport(g.league_name) === sportFilter)

  async function handleJoin() {
    if (!joinCode.trim() || joinCode.length < 4) return
    setJoinLoading(true)
    const res = await fetch('/api/games/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinCode.trim().toUpperCase() }),
    })
    const data = await res.json()
    setJoinLoading(false)
    if (!res.ok) {
      toast(data.error ?? 'Noget gik galt', 'error')
      return
    }
    toast('Du er nu med i spillet!', 'success')
    window.location.href = `/games/${data.game_id}`
  }

  return (
    <div className="min-h-screen" style={{ background: '#F2EDE4' }}>
      <div className="px-4 py-9 max-w-[1140px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-7">
        {/* VENSTRE */}
        <div>
          {/* Greeting */}
          <div className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-[#8C8C78] mb-1">
            Velkommen tilbage
          </div>
          <div className="font-display text-[36px] text-[#2C4A3E] mb-0.5">
            {displayName}
          </div>
          <div className="font-body text-[13px] text-[#8C8C78] mb-6">
            {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })} · {games.length} aktive spilrum
          </div>

          {/* Sport filter */}
          <div className="flex gap-1.5 mb-6">
            {(['alle', 'fodbold', 'cykling'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSportFilter(s)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border cursor-pointer font-condensed text-xs font-semibold tracking-wide capitalize transition-colors"
                style={{
                  background: sportFilter === s ? '#2C4A3E' : 'transparent',
                  borderColor: sportFilter === s ? '#2C4A3E' : 'rgba(44,74,62,0.2)',
                  color: sportFilter === s ? '#F2EDE4' : '#5C5C4A',
                }}
              >
                {s === 'fodbold' ? '⚽ ' : s === 'cykling' ? '🚴 ' : ''}{s.charAt(0).toUpperCase() + s.slice(1)}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                  style={{
                    background: sportFilter === s ? 'rgba(242,237,228,0.15)' : 'rgba(44,74,62,0.08)',
                    color: sportFilter === s ? 'rgba(242,237,228,0.7)' : '#8C8C78',
                  }}
                >
                  {s === 'alle' ? games.length : filteredGames.length}
                </span>
              </button>
            ))}
          </div>

          {/* Spilrum label */}
          <div className="font-condensed text-[10px] font-bold tracking-[0.18em] uppercase text-[#8C8C78] mb-3">
            Dine spilrum
          </div>

          {/* Game cards */}
          {filteredGames.map((game) => {
            const dark = isGameDark(game)
            const dl = deadlineLabel(game.active_round ?? {})
            const bg = dark ? '#2C4A3E' : '#fff'
            const border = dark ? 'none' : '1px solid rgba(44,74,62,0.1)'
            const textPrimary = dark ? '#F2EDE4' : '#2C4A3E'
            const textMuted = dark ? 'rgba(242,237,228,0.4)' : '#8C8C78'
            const divider = dark ? 'rgba(242,237,228,0.08)' : 'rgba(44,74,62,0.07)'
            const labelColor = dark ? 'rgba(242,237,228,0.3)' : '#8C8C78'

            return (
              <div
                key={game.id}
                className="rounded-md overflow-hidden mb-2.5"
                style={{ background: bg, border }}
              >
                {/* Head */}
                <div className="px-5 pt-4 pb-3">
                  <div
                    className="font-condensed text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5 flex items-center gap-1.5"
                    style={{ color: dark ? 'rgba(242,237,228,0.45)' : '#8C8C78' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 inline-block"
                      style={{ background: dark ? '#B8963E' : '#8C8C78' }}
                    />
                    {game.league_name}
                  </div>
                  <div className="font-display text-[21px] text-inherit mb-1" style={{ color: textPrimary }}>
                    {game.name}
                  </div>
                  <div className="font-body text-xs" style={{ color: textMuted }}>
                    {game.active_round?.name ?? 'Ingen aktiv runde'}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4" style={{ borderTop: `1px solid ${divider}` }}>
                  {[
                    { label: 'Placering', value: game.rank ? `#${game.rank}` : '—', gold: !!game.rank && game.rank <= 3 },
                    { label: 'Spillere', value: String(game.member_count) },
                    { label: 'Kode', value: game.invite_code, mono: true },
                  ].map((stat, i, arr) => (
                    <div
                      key={stat.label}
                      className="px-5 py-2.5"
                      style={{ borderRight: i < arr.length - 1 ? `1px solid ${divider}` : 'none' }}
                    >
                      <div
                        className="font-condensed text-[9px] font-bold tracking-[0.14em] uppercase mb-1"
                        style={{ color: labelColor }}
                      >
                        {stat.label}
                      </div>
                      <div
                        className={stat.mono ? 'font-condensed text-[13px] font-semibold tracking-wider' : 'font-display text-[19px]'}
                        style={{ color: stat.gold ? '#B8963E' : textPrimary }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  ))}
                  <div className="px-5 py-2.5" />
                </div>

                {/* Footer */}
                <div
                  className="px-5 py-2 flex items-center justify-between"
                  style={{
                    background: dark ? 'rgba(0,0,0,0.15)' : 'rgba(44,74,62,0.03)',
                    borderTop: dark ? 'none' : '1px solid rgba(44,74,62,0.06)',
                  }}
                >
                  <Link
                    href={`/games/${game.id}`}
                    className="font-condensed text-[11px] font-bold tracking-wider uppercase text-[#B8963E] no-underline"
                  >
                    {game.active_round?.status === 'open' ? 'Afgiv bets →' : 'Gå til spilrum →'}
                  </Link>
                  <div className="font-body text-[11px] flex items-center gap-1.5" style={{ color: dark ? 'rgba(242,237,228,0.35)' : '#8C8C78' }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dl.dot }} />
                    {dl.text}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Opret ny */}
          <Link
            href="/games/new"
            className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-md font-condensed text-[11px] font-bold tracking-wider uppercase no-underline mt-1 box-border"
            style={{ borderColor: 'rgba(44,74,62,0.18)', background: 'transparent', color: '#8C8C78' }}
          >
            + Opret nyt spilrum
          </Link>
        </div>

        {/* HØJRE */}
        <div className="max-[900px]:mt-8">
          {/* Live panel */}
          <div
            className="rounded-md overflow-hidden mb-3.5"
            style={{ background: '#fff', border: '1px solid rgba(44,74,62,0.1)' }}
          >
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(44,74,62,0.07)' }}
            >
              <div className="font-condensed text-[10px] font-bold tracking-[0.16em] uppercase text-[#2C4A3E] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full inline-block bg-[#C0392B]" />
                Live lige nu
              </div>
              <div className="font-body text-[11px] text-[#8C8C78]">
                {liveLeagues.length} ligaer
              </div>
            </div>
            {liveLeagues.length === 0 ? (
              <div className="px-4 py-5 font-body text-xs text-[#8C8C78] text-center leading-relaxed">
                Ingen kampe live lige nu
              </div>
            ) : (
              liveLeagues.map((lg) => (
                <div key={lg.league_id} style={{ borderBottom: '1px solid rgba(44,74,62,0.06)' }}>
                  <div
                    className="px-4 py-1.5 flex items-center gap-2"
                    style={{ background: 'rgba(44,74,62,0.03)' }}
                  >
                    <div className="font-condensed text-[9px] font-bold tracking-[0.14em] uppercase text-[#8C8C78] flex-1">
                      {lg.league_name}
                    </div>
                    <div className="font-condensed text-[9px] font-bold px-2 py-0.5 rounded-lg bg-red-500/10 text-[#C0392B]">
                      {lg.matches.filter((m) => m.status === 'live' || m.status === 'halftime').length} live
                    </div>
                  </div>
                  {lg.matches.map((match) => {
                    const betStatus = match.bet
                      ? match.bet.result === 'win'
                        ? 'win'
                        : match.bet.result === 'loss'
                          ? 'loss'
                          : 'pending'
                      : 'none'
                    const betColors = {
                      win: { bg: 'rgba(44,122,80,0.1)', color: '#2C7A50' },
                      loss: { bg: 'rgba(192,57,43,0.1)', color: '#C0392B' },
                      pending: { bg: 'rgba(44,74,62,0.07)', color: '#8C8C78' },
                      none: { bg: 'rgba(44,74,62,0.07)', color: '#8C8C78' },
                    }
                    const bc = betColors[betStatus as keyof typeof betColors]
                    return (
                      <div
                        key={match.id}
                        className="flex items-center px-4 py-2 gap-2"
                        style={{
                          borderBottom: '1px solid rgba(44,74,62,0.04)',
                          opacity: match.status === 'scheduled' ? 0.6 : 1,
                        }}
                      >
                        <div className="flex-1 font-body text-xs font-medium text-[#2C4A3E] truncate">
                          {match.home_team} – {match.away_team}
                        </div>
                        {match.bet && (
                          <div
                            className="font-condensed text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: bc.bg, color: bc.color }}
                          >
                            {match.bet.prediction}
                          </div>
                        )}
                        <div className="font-display text-sm text-[#2C4A3E] min-w-[32px] text-center shrink-0">
                          {match.status !== 'scheduled' ? `${match.home_score ?? 0} – ${match.away_score ?? 0}` : '—'}
                        </div>
                        <div
                          className="font-condensed text-[10px] font-bold min-w-[26px] text-right shrink-0"
                          style={{
                            color:
                              match.status === 'live'
                                ? '#C0392B'
                                : match.status === 'halftime'
                                  ? '#B8963E'
                                  : '#8C8C78',
                          }}
                        >
                          {match.status === 'live'
                            ? 'LIVE'
                            : match.status === 'halftime'
                              ? 'HT'
                              : match.status === 'finished'
                                ? 'FT'
                                : new Date(match.kickoff_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Bet-deadlines */}
          <div
            className="rounded-md overflow-hidden mb-3.5"
            style={{ background: '#fff', border: '1px solid rgba(44,74,62,0.1)' }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(44,74,62,0.07)' }}>
              <div className="font-condensed text-[10px] font-bold tracking-[0.16em] uppercase text-[#2C4A3E]">
                Bet-deadlines
              </div>
            </div>
            {deadlines.length === 0 ? (
              <div className="px-4 py-4 font-body text-xs text-[#8C8C78]">
                Ingen aktive runder
              </div>
            ) : (
              deadlines.map((dl) => {
                const lbl = deadlineLabel(dl)
                return (
                  <div
                    key={dl.game_id}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: '1px solid rgba(44,74,62,0.05)' }}
                  >
                    <div>
                      <div className="font-condensed text-xs font-bold tracking-wide text-[#2C4A3E]">
                        {dl.game_name}
                      </div>
                      <div className="font-body text-[11px] text-[#8C8C78] mt-0.5">
                        {dl.round_name}
                      </div>
                    </div>
                    <div className="font-condensed text-[11px] font-bold text-right" style={{ color: lbl.color }}>
                      {lbl.text}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Join */}
          <div
            className="rounded-md p-3.5"
            style={{ background: '#fff', border: '1px solid rgba(44,74,62,0.1)' }}
          >
            <div className="font-condensed text-[10px] font-bold tracking-[0.18em] uppercase text-[#8C8C78] mb-2.5">
              Inviteret af en ven?
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="flex gap-1.5">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="FX. ABC123"
                maxLength={6}
                className="flex-1 px-2.5 py-2 border rounded font-condensed text-[13px] tracking-wider text-[#2C4A3E] bg-[#F9F7F3] placeholder:text-[#8C8C78]/60 focus:outline-none focus:border-[#2C4A3E]"
                style={{ borderColor: 'rgba(44,74,62,0.2)' }}
              />
              <button
                type="submit"
                disabled={joinCode.length < 4 || joinLoading}
                className="px-3.5 py-2 bg-[#2C4A3E] text-[#F2EDE4] border-none rounded font-condensed text-[10px] font-bold tracking-wider uppercase cursor-pointer disabled:opacity-40 hover:bg-[#1a3329]"
              >
                {joinLoading ? '...' : 'Join'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
