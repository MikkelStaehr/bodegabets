'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// ÉN delt klient på modul-niveau. Tidligere oprettede siden en ny klient i
// både useEffect OG ved submit — to instanser kan deadlocke auth-lås'en
// (navigator.locks), så updateUser aldrig resolvede → knappen snurrede
// i det uendelige. Register-siden bruger samme single-client-mønster.
const supabase = createBrowserSupabaseClient()

// Promise-timeout-værn: hvis et auth-kald hænger (netværk/lås), kaster vi
// efter N ms i stedet for at lade UI'et snurre for evigt.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}-timeout`)), ms)),
  ])
}

/* ── Vis/skjul adgangskode-toggle ─────────────────────────── */
function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Skjul adgangskode' : 'Vis adgangskode'}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#5C5C4A] hover:text-[#1A1A1A] transition-colors cursor-pointer"
    >
      {shown ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validSession, setValidSession] = useState<boolean | null>(null)

  // Verificér at vi er kommet hertil via et reset-link (Supabase sender PASSWORD_RECOVERY event)
  useEffect(() => {
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
    try {
      const { error: err } = await withTimeout(
        supabase.auth.updateUser({ password }),
        15000,
        'updateUser',
      )
      if (err) {
        setError(err.message)
        setSubmitting(false)
        return
      }
    } catch {
      setError('Det tog for lang tid at gemme. Tjek din forbindelse og prøv igen — eller anmod om et nyt reset-link.')
      setSubmitting(false)
      return
    }

    // Sign out så bruger logger ind med ny kode (best-effort — bloker ikke
    // navigation hvis den hænger).
    try {
      await withTimeout(supabase.auth.signOut(), 5000, 'signOut')
    } catch {
      /* ignorér — koden ER gemt, vi sender videre til login uanset */
    }
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`${inputClass} pr-12`}
              />
              <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
          </div>

          <div>
            <label className="font-condensed text-xs uppercase tracking-[0.08em] block mb-1.5" style={{ fontWeight: 600, color: '#1A1A1A' }}>
              Bekræft ny adgangskode
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className={`${inputClass} pr-12`}
              />
              <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
            {confirm.length > 0 && password !== confirm && (
              <p className="font-body text-xs mt-1.5" style={{ color: '#C8392B' }}>
                ✗ Adgangskoderne er ikke ens
              </p>
            )}
            {confirm.length > 0 && password === confirm && (
              <p className="font-body text-xs mt-1.5" style={{ color: '#3D6B5A' }}>
                ✓ Adgangskoderne matcher
              </p>
            )}
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
