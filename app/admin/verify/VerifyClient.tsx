'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

const supabase = createBrowserSupabaseClient()

type Props = {
  factorId: string
  redirectTo: string
}

export default function VerifyClient({ factorId, redirectTo }: Props) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Start challenge med det samme
  useEffect(() => {
    let cancelled = false
    supabase.auth.mfa.challenge({ factorId }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err || !data) {
        setError(err?.message ?? 'Kunne ikke starte challenge')
        return
      }
      setChallengeId(data.id)
    })
    return () => { cancelled = true }
  }, [factorId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!challengeId || code.length !== 6) return
    setError(null)
    setVerifying(true)

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    })

    if (verifyErr) {
      setError('Forkert kode — prøv igen')
      setCode('')
      setVerifying(false)
      // Re-challenge for next attempt
      supabase.auth.mfa.challenge({ factorId }).then(({ data }) => {
        if (data) setChallengeId(data.id)
      })
      return
    }

    // Success — redirect til target
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        autoFocus
        className="w-full bg-white border-[1.5px] border-[#D4CFC4] text-[#1A1A1A] rounded-sm px-4 py-3 font-mono text-2xl text-center tracking-[0.5em] outline-none focus:border-[#1a3329] transition-colors"
      />

      {error && (
        <div className="bg-[#C8392B]/10 border border-[#C8392B]/30 text-[#C8392B] font-body text-sm rounded-sm px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={verifying || code.length !== 6 || !challengeId}
        className="w-full font-condensed uppercase tracking-[0.08em] text-sm px-8 py-4 rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px]"
        style={{ fontWeight: 700, background: '#1a3329', color: '#F2EDE4' }}
      >
        {verifying ? 'Verificerer...' : 'Bekræft og fortsæt →'}
      </button>

      <p className="text-center font-body text-xs pt-4" style={{ color: '#5C5C4A' }}>
        <Link href="/dashboard" className="hover:opacity-70">
          ← Tilbage til dashboard
        </Link>
      </p>
    </form>
  )
}
