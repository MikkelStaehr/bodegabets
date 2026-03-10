'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

export default function JoinGameCard() {
  const router = useRouter()
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!code.trim() || code.length < 4) return
    setLoading(true)

    const res = await fetch('/api/games/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code.trim().toUpperCase() }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast(data.error ?? 'Noget gik galt', 'error')
      return
    }

    toast('Du er nu med i spillet!', 'success')
    router.push(`/games/${data.game_id}`)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-black/8 px-5 py-4">
      <p className="text-[11px] font-semibold text-[#7a7060] uppercase tracking-widest mb-3">Inviteret af en ven?</p>
      <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="FX. ABC123"
          maxLength={6}
          className="flex-1 text-[13px] border border-black/15 rounded-lg px-3 py-2 font-['Barlow_Condensed'] font-bold tracking-widest text-[#1a3329] placeholder:text-[#7a7060]/50 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-[#2C4A3E]"
        />
        <button
          type="submit"
          disabled={code.length < 4 || loading}
          className="px-4 py-2 bg-[#2C4A3E] text-white text-[12px] font-bold rounded-lg disabled:opacity-40 hover:bg-[#1a3329] transition-colors"
        >
          {loading ? '...' : 'Join'}
        </button>
      </form>
    </div>
  )
}
