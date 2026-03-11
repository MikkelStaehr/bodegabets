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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_3fr]">

      {/* ══════════════════════════════════════════════════════
          VENSTRE PANEL — forest
          ══════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col relative overflow-hidden"
        style={{ background: '#1a3329' }}
      >
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 20% 80%, rgba(184,150,62,0.08) 0%, transparent 60%)' }}
        />
        {/* Guld vertikal linje */}
        <div
          className="absolute top-0 right-0 w-[1px] h-full"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(184,150,62,0.2) 30%, rgba(184,150,62,0.2) 70%, transparent)' }}
        />

        {/* Midten */}
        <div className="flex-1 flex items-center px-10">
          <div className="max-w-md">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-8">
              <span className="block w-8 h-[2px] bg-gold" />
              <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
                Velkommen tilbage
              </span>
            </div>

            <h1 className="mb-8">
              <span
                className="block font-condensed text-cream uppercase leading-[0.95]"
                style={{ fontWeight: 800, fontSize: '56px' }}
              >
                Klar til
              </span>
              <span
                className="block font-display italic text-gold leading-[1.05]"
                style={{ fontWeight: 900, fontSize: '62px' }}
              >
                action?
              </span>
            </h1>

            <p className="font-body text-cream/45 text-base leading-relaxed mb-12 max-w-sm">
              Dine spilrum venter. Log ind og se hvad der er sket siden sidst.
            </p>

            {/* Perks */}
            <div className="space-y-5">
              {[
                { icon: '🏆', text: 'Se din placering på leaderboardet' },
                { icon: '⚽', text: 'Afgiv bets på dagens kampe' },
                { icon: '🔴', text: 'Live resultater i realtid' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-4">
                  <span
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base"
                    style={{ background: 'rgba(184,150,62,0.08)', border: '1.5px solid rgba(184,150,62,0.25)' }}
                  >
                    {icon}
                  </span>
                  <span className="font-body text-cream/60 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bund */}
        <div className="px-10 pb-8">
          <p className="font-body text-cream/20 text-xs">
            © 2026 Bodega Bets — Ingen rigtige penge involveret
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          HØJRE PANEL — cream + formular
          ══════════════════════════════════════════════════════ */}
      <div className="bg-cream flex items-center justify-center px-6 py-12 lg:py-0 min-h-screen">
        <div className="w-full max-w-[420px]">

          {/* Mobil logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="inline-block">
              <span className="font-display italic text-ink text-xl" style={{ fontWeight: 700 }}>
                Bodega <span className="text-gold">Bets</span>
              </span>
            </Link>
          </div>

          <h1 className="font-display text-ink mb-1" style={{ fontWeight: 700, fontSize: 'clamp(26px, 4vw, 32px)' }}>
            Velkommen tilbage
          </h1>
          <p className="font-body text-warm-gray text-sm mb-8">
            Log ind for at se dine spil og afgive bets
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── E-mail ─────────────────────────────────────── */}
            <div>
              <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
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

            {/* ── Adgangskode ────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-condensed text-xs uppercase tracking-[0.08em] text-ink" style={{ fontWeight: 600 }}>
                  Adgangskode
                </label>
                <Link
                  href="/forgot-password"
                  className="font-body text-xs text-warm-gray hover:text-ink transition-colors"
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

            {/* ── Error ──────────────────────────────────────── */}
            {error && (
              <div className="bg-[#C8392B]/10 border border-[#C8392B]/30 text-[#C8392B] font-body text-sm rounded-sm px-4 py-3">
                {error}
              </div>
            )}

            {/* ── Submit ─────────────────────────────────────── */}
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

          {/* ── Footer link ──────────────────────────────────── */}
          <p className="text-center font-body text-sm text-warm-gray mt-6">
            Ingen konto endnu?{' '}
            <Link href="/register" className="text-forest font-semibold hover:opacity-70 transition-opacity">
              Opret konto gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
