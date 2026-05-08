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

  // 2FA challenge state — vises efter korrekt password hvis MFA er enrolled
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')

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

    // Tjek om bruger har MFA enrolled — i så fald kræv challenge før vi sender til dashboard
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalData?.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
      // MFA påkrævet — start challenge
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find((f) => f.status === 'verified')
      if (totp) {
        const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (challengeErr || !challenge) {
          setError(challengeErr?.message ?? 'Kunne ikke starte 2FA-challenge')
          setLoading(false)
          return
        }
        setMfaChallenge({ factorId: totp.id, challengeId: challenge.id })
        setLoading(false)
        return
      }
    }

    router.refresh()
    router.push('/dashboard')
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaChallenge || mfaCode.length !== 6) return
    setError(null)
    setLoading(true)

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: mfaChallenge.factorId,
      challengeId: mfaChallenge.challengeId,
      code: mfaCode,
    })

    if (verifyErr) {
      setError('Forkert kode — prøv igen')
      setLoading(false)
      setMfaCode('')
      return
    }

    router.refresh()
    router.push('/dashboard')
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
            <span className="logo-font" style={{ fontSize: '40px', color: '#2C4A3E' }}>
              bodega bets
            </span>
          </Link>
        </div>

        <h1 className="font-display text-center mb-1" style={{ fontWeight: 700, fontSize: '28px', color: '#1A1A1A' }}>
          Velkommen tilbage
        </h1>
        <p className="font-body text-center text-sm mb-8" style={{ color: '#5C5C4A' }}>
          Log ind for at se dine spil og afgive bets
        </p>

        {mfaChallenge ? (
          <form onSubmit={handleMfaSubmit} className="space-y-5">
            <div className="text-center mb-2">
              <p className="font-condensed text-xs uppercase tracking-[0.14em] text-[#7a7060] mb-2">
                To-faktor godkendelse
              </p>
              <p className="font-body text-sm" style={{ color: '#5C5C4A' }}>
                Indtast den 6-cifrede kode fra din authenticator-app
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
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
              disabled={loading || mfaCode.length !== 6}
              className="w-full font-condensed uppercase tracking-[0.08em] text-sm px-8 py-4 rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px]"
              style={{ fontWeight: 700, background: '#2C4A3E', color: '#F2EDE4' }}
            >
              {loading ? 'Bekræfter...' : 'Bekræft og log ind'}
            </button>

            <button
              type="button"
              onClick={() => { setMfaChallenge(null); setMfaCode(''); supabase.auth.signOut() }}
              className="w-full font-body text-sm hover:opacity-70 transition-opacity"
              style={{ color: '#5C5C4A' }}
            >
              ← Tilbage
            </button>
          </form>
        ) : (
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

          {/* Husk mig */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#2C4A3E] rounded-sm cursor-pointer"
              defaultChecked
            />
            <span className="font-body text-sm" style={{ color: '#5C5C4A' }}>Husk mig</span>
          </label>

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
        )}

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
