'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type GameSummary = {
  id: number
  name: string
  invite_code: string
  status: string
  created_at: string
  member_count: number
}

type Props = {
  adminSecret: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('da-DK', {
    timeZone: 'Europe/Copenhagen',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function AdminGamesTab({ adminSecret }: Props) {
  const router = useRouter()
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<Set<number>>(new Set())

  const authHeader = { Authorization: `Bearer ${adminSecret}` }

  useEffect(() => {
    fetchGames()
  }, [])

  async function fetchGames() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/games', { headers: authHeader })
      const data = await res.json()
      if (data.games) setGames(data.games)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(gameId: number) {
    setDeleteLoading((s) => new Set(s).add(gameId))
    try {
      const res = await fetch(`/api/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: authHeader,
      })
      const data = await res.json()
      if (data.ok) {
        setGames((prev) => prev.filter((g) => g.id !== gameId))
        setDeleteConfirm(null)
        router.refresh()
      } else {
        alert(data.error ?? 'Fejl ved sletning')
      }
    } catch {
      alert('Netværksfejl')
    } finally {
      setDeleteLoading((s) => { const n = new Set(s); n.delete(gameId); return n })
    }
  }

  const filtered = query.trim().length > 0
    ? games.filter((g) =>
        g.name.toLowerCase().includes(query.toLowerCase()) ||
        g.invite_code.toLowerCase().includes(query.toLowerCase())
      )
    : games

  return (
    <div>
      <p className="font-condensed uppercase text-warm-gray mb-0.5" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Administration</p>
      <h2 className="font-condensed font-bold text-ink text-lg uppercase tracking-wide mb-4">Spilrum</h2>

      {/* Filter */}
      <div className="mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer på navn eller kode..."
          className="w-full font-body text-sm text-ink border border-warm-border bg-cream px-4 py-3 placeholder:text-warm-gray/50 focus:outline-none focus:border-forest rounded-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <span className="font-condensed text-sm text-warm-gray uppercase tracking-wide">Henter spilrum...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-warm-border bg-cream-dark p-10 text-center rounded-sm">
          <p className="font-body text-warm-gray text-sm">
            {query.trim() ? `Ingen rum matcher "${query}"` : 'Ingen spilrum oprettet endnu.'}
          </p>
        </div>
      ) : (
        <div className="border border-warm-border overflow-x-auto rounded-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-dark border-b border-warm-border">
                {['Navn', 'Kode', 'Deltagere', 'Oprettet', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-border">
              {filtered.map((game) => {
                const isConfirming = deleteConfirm === game.id
                const isDeleting = deleteLoading.has(game.id)

                return (
                  <tr key={game.id} className="bg-cream hover:bg-cream-dark/40 transition-colors">
                    <td className="px-4 py-3">
                      <a
                        href={`/games/${game.id}`}
                        className="font-body text-sm font-medium text-ink hover:text-forest transition-colors"
                      >
                        {game.name}
                      </a>
                    </td>
                    <td className="px-4 py-3 font-condensed text-sm tracking-widest text-ink">{game.invite_code}</td>
                    <td className="px-4 py-3 font-condensed text-sm text-center text-ink">{game.member_count}</td>
                    <td className="px-4 py-3 font-body text-sm text-warm-gray">{formatDate(game.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-condensed text-xs uppercase tracking-wide px-2 py-0.5 rounded-sm border ${
                        game.status === 'active'
                          ? 'text-forest bg-forest/10 border-forest/30'
                          : 'text-warm-gray bg-warm-border/40 border-warm-border'
                      }`}>
                        {game.status === 'active' ? 'Aktiv' : 'Afsluttet'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isConfirming ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-body text-xs text-vintage-red">Er du sikker?</span>
                          <button
                            onClick={() => handleDelete(game.id)}
                            disabled={isDeleting}
                            className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 bg-vintage-red text-cream rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity cursor-pointer"
                          >
                            {isDeleting ? 'Sletter...' : 'Ja, slet'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 border border-warm-border text-warm-gray rounded-sm hover:border-ink transition-colors cursor-pointer"
                          >
                            Annullér
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(game.id)}
                          className="font-condensed text-xs uppercase tracking-wide px-3 py-1.5 border border-vintage-red/40 text-vintage-red rounded-sm hover:bg-vintage-red hover:text-cream transition-colors cursor-pointer"
                        >
                          Slet
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
