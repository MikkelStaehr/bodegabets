'use client'

import { useState } from 'react'

export default function SubscribeButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Kunne ikke starte checkout')
      }
      window.location.href = data.url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="inline-flex items-center justify-center px-10 py-4 bg-forest text-cream font-condensed font-bold text-[13px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? 'Sender til Stripe…' : 'Tegn medlemskab → €1/måned'}
      </button>
      {error && (
        <p className="font-body text-sm text-vintage-red text-center max-w-sm">
          {error}
        </p>
      )}
    </div>
  )
}
