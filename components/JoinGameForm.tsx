'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

export default function JoinGameForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/games/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Noget gik galt')
      return
    }

    toast(`Du er nu med i spillet!`, 'success')
    router.push(`/games/${data.game_id}`)
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Fx. ABC123"
          maxLength={6}
          required
          className="flex-1 bg-white border-[1.5px] border-warm-border text-ink placeholder-warm-gray rounded-sm px-4 py-3 font-condensed font-700 text-base uppercase tracking-[0.2em] outline-none focus:border-forest transition-colors"
        />
        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="bg-forest text-cream font-condensed font-700 text-sm uppercase tracking-[0.08em] px-6 py-3 rounded-sm hover:opacity-85 disabled:opacity-40 transition-opacity whitespace-nowrap"
        >
          {loading ? 'Finder...' : 'Join spil'}
        </button>
      </form>
      {error && (
        <p className="font-body text-vintage-red text-sm mt-2">{error}</p>
      )}
    </div>
  )
}
