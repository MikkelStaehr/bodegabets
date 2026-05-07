'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validSession, setValidSession] = useState<boolean | null>(null)

  // Verificér at vi er kommet hertil via et reset-link (Supabase sender PASSWORD_RECOVERY event)
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Adgangskoden skal være mindst 6 tegn')
      return
    }
    if (password !== confirm) {
      setError('De to adgangskoder matcher ikke')
      return
    }

    setSubmitting(true)
    const supabase = createBrowserSupabaseClient()
    const { error: err } = await supabase.auth.updateUser({ password })

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    // Sign out så bruger logger ind med ny kode
    await supabase.auth.signOut()
    router.push('/login?reset=ok')
  }

  const inputClass =
    'w-full px-4 py-3 rounded-sm border border-[#D4CEC4] bg-white font-body text-base focus:outline-none focus:border-[#1a3329] transition-colors'

  if (validSession === false) {
    return (
      <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-3xl font-bold text-[#1a3329] mb-4">
            Linket er udløbet
          </h1>
          <p className="font-body text-[#5C5C4A] mb-8">
            Reset-links virker kun i 1 time. Anmod om et nyt for at fortsætte.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block px-6 py-3 rounded-sm bg-[#1a3329] text-[#F2EDE4] font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-[#2c4a3e]"
          >
            Anmod om nyt link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold text-[#1a3329] mb-2">
          Vælg ny adgangskode
        </h1>
        <p className="font-body text-[#5C5C4A] mb-8">
          Indtast den adgangskode du gerne vil bruge fremover.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-condensed text-xs uppercase tracking-[0.08em] block mb-1.5" style={{ fontWeight: 600, color: '#1A1A1A' }}>
              Ny adgangskode
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
            />
          </div>

          <div>
            <label className="font-condensed text-xs uppercase tracking-[0.08em] block mb-1.5" style={{ fontWeight: 600, color: '#1A1A1A' }}>
              Bekræft ny adgangskode
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="p-3 rounded-sm border border-red-300 bg-red-50 font-body text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password || !confirm}
            className="w-full px-6 py-3 rounded-sm bg-[#1a3329] text-[#F2EDE4] font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-[#2c4a3e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Gemmer...' : 'Gem ny adgangskode'}
          </button>
        </form>
      </div>
    </div>
  )
}
