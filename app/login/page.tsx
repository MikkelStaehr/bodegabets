'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

const supabase = createBrowserSupabaseClient()

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setLoading(false)
      if (
        signInError.message.includes('Invalid login credentials') ||
        signInError.message.includes('invalid_credentials')
      ) {
        return setError('Forkert email eller adgangskode')
      }
      return setError(signInError.message)
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputClass =
    'w-full bg-white border-[1.5px] border-[#D4CFC4] text-[#1A1A1A] placeholder-[#5C5C4A]/50 rounded-sm px-4 py-3 font-body text-sm outline-none focus:border-[#1a3329] transition-colors min-h-[44px]'

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12 relative"
      style={{ background: '#1a3329' }}
    >
      {/* Radial gold glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(184,150,62,0.07) 0%, transparent 60%)' }}
      />

      {/* Login kort */}
      <div
        className="relative w-full max-w-[440px] rounded-sm p-8 sm:p-10"
        style={{ background: '#F2EDE4', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <span style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: '28px', color: '#2C4A3E', marginRight: '-4px' }}>B</span>
              <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: '14px', color: '#2C4A3E' }}>odega</span>
              <span style={{ display: 'inline-block', width: '4px' }} />
              <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: '28px', color: '#2C4A3E', marginRight: '-4px' }}>B</span>
              <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: '14px', color: '#2C4A3E' }}>ets</span>
            </span>
          </Link>
        </div>

        <h1 className="font-display text-center mb-1" style={{ fontWeight: 700, fontSize: '28px', color: '#1A1A1A' }}>
          Velkommen tilbage
        </h1>
        <p className="font-body text-center text-sm mb-8" style={{ color: '#5C5C4A' }}>
          Log ind for at se dine spil og afgive bets
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* E-mail */}
          <div>
            <label className="block font-condensed text-xs uppercase tracking-[0.08em] mb-1.5" style={{ fontWeight: 600, color: '#1A1A1A' }}>
              E-mail
            </label>
            <input
              type="email"
              placeholder="din@email.dk"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* Adgangskode */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-condensed text-xs uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: '#1A1A1A' }}>
                Adgangskode
              </label>
              <Link
                href="/forgot-password"
                className="font-body text-xs hover:opacity-70 transition-opacity"
                style={{ color: '#5C5C4A' }}
              >
                Glemt adgangskode?
              </Link>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-[#C8392B]/10 border border-[#C8392B]/30 text-[#C8392B] font-body text-sm rounded-sm px-4 py-3">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 font-condensed uppercase tracking-[0.08em] text-sm px-8 py-4 rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px]"
            style={{ fontWeight: 700, background: '#2C4A3E', color: '#F2EDE4' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#1a3329' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2C4A3E' }}
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? 'Logger ind...' : 'Log ind →'}
          </button>
        </form>

        {/* Footer link */}
        <p className="text-center font-body text-sm mt-6" style={{ color: '#5C5C4A' }}>
          Ingen konto endnu?{' '}
          <Link href="/register" className="font-semibold hover:opacity-70 transition-opacity" style={{ color: '#1a3329' }}>
            Opret konto gratis
          </Link>
        </p>
      </div>
    </div>
  )
}
