'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinClient({ code, gameName }: { code: string; gameName: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<'joining' | 'ok' | 'error'>('joining')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setStatus('error')
          setError(data.error ?? 'Kunne ikke tilmelde')
          return
        }
        setStatus('ok')
        setTimeout(() => router.push(`/games/${data.game_id}`), 600)
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        setError('Netværksfejl')
      })
    return () => { cancelled = true }
  }, [code, router])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-warm-border rounded-sm p-8 text-center">
        <p className="font-condensed text-[11px] uppercase tracking-[0.14em] text-warm-gray mb-2">Inviteret til</p>
        <h1 className="font-display text-2xl text-forest font-bold mb-6 truncate">{gameName}</h1>

        {status === 'joining' && (
          <p className="font-body text-sm text-warm-gray">Tilmelder dig spilrummet…</p>
        )}

        {status === 'ok' && (
          <p className="font-body text-sm text-forest font-semibold">Du er med! Henter spilrummet…</p>
        )}

        {status === 'error' && (
          <>
            <p className="font-body text-sm text-vintage-red mb-6">{error}</p>
            <a
              href="/dashboard"
              className="inline-block px-5 py-3 bg-forest text-cream font-condensed font-bold text-sm uppercase tracking-[0.08em] rounded-sm"
            >
              Til dashboard
            </a>
          </>
        )}
      </div>
    </div>
  )
}
