'use client'

import { useState } from 'react'

export default function ManageButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Kunne ikke åbne portalen')
      }
      window.location.href = data.url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center px-6 py-3 bg-forest text-cream font-condensed font-bold text-[12px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait self-start"
      >
        {loading ? 'Åbner…' : 'Administrér betaling →'}
      </button>
      {error && <p className="font-body text-sm text-vintage-red">{error}</p>}
    </div>
  )
}
