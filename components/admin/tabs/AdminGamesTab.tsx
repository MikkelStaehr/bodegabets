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
      ? 'bg-forest/10 text-forest border-forest/30'
      : 'bg-cream-dark text-warm-gray border-warm-border'
  return (
    <span
      className={`font-condensed text-xs uppercase tracking-wide border px-2 py-0.5 ${colors}`}
      style={{ borderRadius: '2px' }}
    >
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
    <div className="border border-warm-border overflow-hidden" style={{ borderRadius: '2px' }}>
      <div className="bg-forest px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-condensed text-xl font-bold text-cream uppercase">
            {game.name}
          </h3>
          <p className="font-body text-cream/60 text-[12px] mt-0.5">
            {game.league_name} · Oprettet {formatDate(game.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-condensed text-[10px] text-cream/50 uppercase tracking-wider">Kode</p>
          <p className="font-condensed text-xl font-bold text-gold">
            {game.invite_code}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-warm-border border-b border-warm-border bg-cream">
        {[
          { label: 'Deltagere', value: String(game.member_count) },
          { label: 'Aktiv runde', value: game.current_round_name },
          { label: 'Afgivne bets', value: game.total_bets.toLocaleString('da-DK') },
          { label: 'Status', value: <StatusBadge status={game.status} /> },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="font-condensed text-[9px] font-bold text-warm-gray uppercase tracking-wider mb-1">
              {label}
            </p>
            <div className="font-condensed text-[15px] font-bold text-ink">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 bg-cream">
        <p className="font-condensed text-[11px] font-bold text-warm-gray uppercase tracking-wider mb-3">
          Deltagere
        </p>
        <div className="flex flex-wrap gap-2">
          {game.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-cream-dark"
              style={{ borderRadius: '2px' }}
            >
              <span className="font-body text-[12px] font-medium text-ink">
                {member.username}
              </span>
              <span className="font-body text-[11px] text-warm-gray">
                #{member.rank} · {member.points.toLocaleString('da-DK')} pt
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 bg-cream-dark border-t border-warm-border flex justify-end">
        <button
          onClick={() => onDelete(game.id, game.name)}
          className="font-condensed text-[12px] font-semibold text-vintage-red hover:text-vintage-red/90 px-4 py-2 border border-vintage-red/30 hover:border-vintage-red/50 transition-colors"
          style={{ borderRadius: '2px' }}
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
      <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Administration</p>
      <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">Søg rum</h2>

      <div className="flex gap-3 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Invitationskode (fx. ABC123) eller rum-navn..."
          className="flex-1 font-condensed text-[14px] tracking-widest text-ink border border-warm-border bg-cream px-4 py-3 placeholder:font-body placeholder:tracking-normal placeholder:text-warm-gray/50 focus:outline-none focus:border-forest"
          style={{ borderRadius: '2px' }}
        />
        <button
          onClick={handleSearch}
          disabled={query.trim().length < 3 || loading}
          className="font-condensed px-6 py-3 bg-forest text-cream text-[13px] font-bold disabled:opacity-40 hover:bg-ink transition-colors"
          style={{ borderRadius: '2px' }}
        >
          {loading ? 'Søger...' : 'Søg'}
        </button>
      </div>

      {notFound && (
        <p className="font-body text-[13px] text-warm-gray text-center py-8">
          Intet rum fundet med koden eller navnet &quot;{query}&quot;
        </p>
      )}

      {result && (
        <GameDetailCard game={result} onDelete={handleDelete} />
      )}
    </div>
  )
}
