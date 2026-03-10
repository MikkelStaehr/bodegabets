'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type User = {
  id: string
  email: string
  username: string
  created_at: string
  games_count: number
  last_active: string | null
  is_suspended: boolean
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

export function AdminUsersTab({ adminSecret }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [suspendLoading, setSuspendLoading] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({})

  const authHeader = { Authorization: `Bearer ${adminSecret}` }

  useEffect(() => {
    fetch('/api/admin/users', { headers: authHeader })
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  async function toggleSuspend(user: User) {
    const suspend = !user.is_suspended
    setSuspendLoading((s) => new Set(s).add(user.id))
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspend }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessages((prev) => ({
          ...prev,
          [user.id]: { type: 'ok', text: suspend ? 'Bruger suspenderet' : 'Bruger genaktiveret' },
        }))
        setTimeout(() => setMessages((prev) => { const n = { ...prev }; delete n[user.id]; return n }), 3000)
        router.refresh()
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_suspended: suspend } : u))
        )
      } else {
        setMessages((prev) => ({ ...prev, [user.id]: { type: 'err', text: data.error ?? 'Fejl' } }))
      }
    } catch {
      setMessages((prev) => ({ ...prev, [user.id]: { type: 'err', text: 'Netværksfejl' } }))
    } finally {
      setSuspendLoading((s) => { const n = new Set(s); n.delete(user.id); return n })
    }
  }

  const filtered = users.filter(
    (u) =>
      !search ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="rounded-xl border border-black/8 bg-white p-12 text-center text-[#7a7060]">
        Henter brugere...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <input
          type="search"
          placeholder="Søg på navn eller email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-black/10 rounded-lg px-4 py-2.5 text-sm placeholder:text-[#7a7060]"
        />
      </div>

      <div className="rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-black/5 border-b border-black/8">
              {['#', 'Navn', 'Email', 'Oprettet', 'Spilrum', 'Sidst aktiv', 'Status', 'Handling'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold text-[#7a7060] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => {
              const msg = messages[user.id]
              const suspending = suspendLoading.has(user.id)
              return (
                <tr key={user.id} className="border-b border-black/6 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 text-[13px] text-[#7a7060]">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-[#1a3329]">{user.username || '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-[#7a7060]">{user.email || '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-[#7a7060]">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3 text-[13px] text-[#1a3329]">{user.games_count}</td>
                  <td className="px-4 py-3 text-[13px] text-[#7a7060]">{user.last_active ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        user.is_suspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {user.is_suspended ? 'Suspenderet' : 'Aktiv'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {msg && (
                        <span className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                          {msg.text}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          if (user.is_suspended) {
                            toggleSuspend(user)
                          } else {
                            if (confirm(`Suspendér bruger "${user.username || user.email}"?`)) {
                              toggleSuspend(user)
                            }
                          }
                        }}
                        disabled={suspending}
                        className={`text-[11px] font-bold px-3 py-1 rounded disabled:opacity-50 ${
                          user.is_suspended
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {suspending ? '...' : user.is_suspended ? 'Genaktivér' : 'Suspendér'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-[#7a7060] text-sm">
            Ingen brugere fundet
          </div>
        )}
      </div>
    </div>
  )
}
