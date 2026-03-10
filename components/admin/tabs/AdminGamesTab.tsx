'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type GameDetail = {
  id: number
  name: string
  invite_code: string
  status: string
  created_at: string
  league_name: string
  member_count: number
  current_round_name: string
  total_bets: number
  members: Array<{ id: string; username: string; rank: number; points: number }>
}

type Props = {
  adminSecret: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const colors =
    status === 'active'
      ? 'bg-green-100 text-green-700'
      : 'bg-black/10 text-[#7a7060]'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colors}`}>
      {status === 'active' ? 'Aktiv' : 'Afsluttet'}
    </span>
  )
}

function GameDetailCard({
  game,
  onDelete,
}: {
  game: GameDetail
  onDelete: (id: number, name: string) => void
}) {
  return (
    <div className="border border-black/8 rounded-xl overflow-hidden">
      <div className="bg-[#2C4A3E] px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-['Barlow_Condensed'] text-xl font-bold text-white uppercase">
            {game.name}
          </h3>
          <p className="text-white/60 text-[12px] mt-0.5">
            {game.league_name} · Oprettet {formatDate(game.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/50 uppercase tracking-wider">Kode</p>
          <p className="font-['Barlow_Condensed'] text-xl font-bold text-[#B8963E]">
            {game.invite_code}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-black/8 border-b border-black/8 bg-white">
        {[
          { label: 'Deltagere', value: String(game.member_count) },
          { label: 'Aktiv runde', value: game.current_round_name },
          { label: 'Afgivne bets', value: game.total_bets.toLocaleString('da-DK') },
          { label: 'Status', value: <StatusBadge status={game.status} /> },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-[9px] font-bold text-[#7a7060] uppercase tracking-wider mb-1">
              {label}
            </p>
            <div className="font-['Barlow_Condensed'] text-[15px] font-bold text-[#1a3329]">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 bg-white">
        <p className="text-[11px] font-bold text-[#7a7060] uppercase tracking-wider mb-3">
          Deltagere
        </p>
        <div className="flex flex-wrap gap-2">
          {game.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-black/4 rounded-full"
            >
              <span className="text-[12px] font-medium text-[#1a3329]">
                {member.username}
              </span>
              <span className="text-[11px] text-[#7a7060]">
                #{member.rank} · {member.points.toLocaleString('da-DK')} pt
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 bg-[#fafaf8] border-t border-black/8 flex justify-end">
        <button
          onClick={() => onDelete(game.id, game.name)}
          className="text-[12px] font-semibold text-red-500 hover:text-red-700 px-4 py-2 border border-red-200 rounded-lg hover:border-red-400 transition-colors"
        >
          Slet rum
        </button>
      </div>
    </div>
  )
}

export function AdminGamesTab({ adminSecret }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const authHeader = { Authorization: `Bearer ${adminSecret}` }

  async function handleSearch() {
    if (query.trim().length < 3) return
    setLoading(true)
    setResult(null)
    setNotFound(false)
    try {
      const res = await fetch(
        `/api/admin/games/search?q=${encodeURIComponent(query.trim())}`,
        { headers: authHeader }
      )
      const data = await res.json()
      if (data.notFound) {
        setNotFound(true)
      } else if (data.game) {
        setResult(data.game)
      }
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(gameId: number, gameName: string) {
    if (
      !confirm(
        `Er du sikker på du vil slette "${gameName}"?\n\nDette sletter også alle runder og bets. Dette kan ikke fortrydes.`
      )
    )
      return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: authHeader,
      })
      const data = await res.json()
      if (data.ok) {
        setResult(null)
        setNotFound(false)
        router.refresh()
      } else {
        alert(data.error ?? 'Fejl ved sletning')
      }
    } catch {
      alert('Netværksfejl')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      <h3 className="text-[11px] font-bold text-[#7a7060] uppercase tracking-widest mb-4">
        Søg rum
      </h3>

      <div className="flex gap-3 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Invitationskode (fx. ABC123) eller rum-navn..."
          className="flex-1 text-[14px] border border-black/15 rounded-xl px-4 py-3 font-['Barlow_Condensed'] tracking-widest text-[#1a3329] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#7a7060]/50 focus:outline-none focus:border-[#2C4A3E]"
        />
        <button
          onClick={handleSearch}
          disabled={query.trim().length < 3 || loading}
          className="px-6 py-3 bg-[#2C4A3E] text-white text-[13px] font-bold rounded-xl disabled:opacity-40 hover:bg-[#1a3329] transition-colors"
        >
          {loading ? 'Søger...' : 'Søg'}
        </button>
      </div>

      {notFound && (
        <p className="text-[13px] text-[#7a7060] text-center py-8">
          Intet rum fundet med koden eller navnet &quot;{query}&quot;
        </p>
      )}

      {result && (
        <GameDetailCard game={result} onDelete={handleDelete} />
      )}
    </div>
  )
}
