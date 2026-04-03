'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useToast } from '@/components/ui/Toast'
import { registerServiceWorker, subscribeToPush, getExistingSubscription } from '@/lib/pushNotifications'

const supabase = createBrowserSupabaseClient()

/* ── Password strength ────────────────────────────────────── */
function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: 'Svag', color: '#C8392B' }
  if (score === 2) return { level: 2, label: 'Middel', color: '#B8963E' }
  return { level: 3, label: 'Stærk', color: '#3D6B5A' }
}

/* ── Debounce hook ────────────────────────────────────────── */
function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type Props = {
  userId: string
  userEmail: string
  initialUsername: string
}

export default function ProfileEditClient({ userId, userEmail, initialUsername }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  /* ── Form state ────────────────────────────────────────── */
  const [username, setUsername] = useState(initialUsername)
  const [originalUsername, setOriginalUsername] = useState(initialUsername)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /* ── Password state ────────────────────────────────────── */
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  /* ── Push notifications state ────────────────────────────── */
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(true)
  const [pushToggling, setPushToggling] = useState(false)

  /* ── Load push subscription status ──────────────────────── */
  const checkPush = useCallback(async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        const res = await fetch('/api/push-subscription')
        const { subscribed } = await res.json()
        setPushEnabled(subscribed)
      } catch {
        // Ignore
      }
    }
    setPushLoading(false)
  }, [])

  useEffect(() => {
    checkPush()
  }, [checkPush])

  /* ── Username availability ─────────────────────────────── */
  const debouncedUsername = useDebounce(username.trim(), 500)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const usernameChanged = username.trim() !== originalUsername

  useEffect(() => {
    if (!usernameChanged || debouncedUsername.length < 3) {
      setUsernameStatus('idle')
      return
    }
    let cancelled = false
    setUsernameStatus('checking')
    supabase
      .from('profiles')
      .select('id')
      .eq('username', debouncedUsername)
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return
        setUsernameStatus(data && data.length > 0 ? 'taken' : 'available')
      })
    return () => { cancelled = true }
  }, [debouncedUsername, usernameChanged])

  /* ── Push notification toggle ─────────────────────────── */
  async function handlePushToggle() {
    setPushToggling(true)
    try {
      if (pushEnabled) {
        // Unsubscribe
        const registration = await registerServiceWorker()
        if (registration) {
          const sub = await getExistingSubscription(registration)
          if (sub) {
            await fetch('/api/push-subscription', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            })
            await sub.unsubscribe()
          }
        }
        setPushEnabled(false)
        toast('Notifikationer slået fra', 'success')
      } else {
        // Subscribe
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setPushToggling(false)
          return
        }
        const registration = await registerServiceWorker()
        if (!registration) {
          setPushToggling(false)
          return
        }
        let subscription = await getExistingSubscription(registration)
        if (!subscription) {
          subscription = await subscribeToPush(registration)
        }
        if (subscription) {
          await fetch('/api/push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
          })
          setPushEnabled(true)
          toast('Notifikationer slået til', 'success')
        }
      }
    } catch {
      // Ignore errors
    }
    setPushToggling(false)
  }

  /* ── Initials ──────────────────────────────────────────── */
  const initials = username[0]?.toUpperCase() ?? '?'

  /* ── Password strength ─────────────────────────────────── */
  const strength = getPasswordStrength(newPassword)

  /* ── Submit ────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) return setError('Brugernavn skal være mindst 3 tegn')
    if (usernameChanged && usernameStatus === 'taken') return setError('Brugernavnet er allerede taget')

    // Validate password fields
    if (newPassword && !currentPassword) return setError('Indtast din nuværende adgangskode')
    if (newPassword && newPassword.length < 6) return setError('Ny adgangskode skal være mindst 6 tegn')

    setSaving(true)

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        username: trimmedUsername,
      })
      .eq('id', userId)

    if (profileError) {
      setSaving(false)
      return setError('Kunne ikke gemme profil: ' + profileError.message)
    }

    // Update password if provided
    if (newPassword && currentPassword) {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      })

      if (signInError) {
        setSaving(false)
        return setError('Nuværende adgangskode er forkert')
      }

      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
      if (pwError) {
        setSaving(false)
        return setError('Kunne ikke ændre adgangskode: ' + pwError.message)
      }
    }

    setSaving(false)
    setOriginalUsername(trimmedUsername)
    setCurrentPassword('')
    setNewPassword('')
    toast('Profil opdateret ✓', 'success')
    router.refresh()
  }

  /* ── Input classes ─────────────────────────────────────── */
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

      {/* Profile kort */}
      <div
        className="relative w-full max-w-[480px] rounded-sm p-8 sm:p-10"
        style={{ background: '#F2EDE4', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/dashboard" className="inline-block">
            <span style={{ fontFamily: "'Cocogoose', sans-serif", fontWeight: 700, fontSize: '28px', letterSpacing: '-0.03em', textTransform: 'lowercase' as const, lineHeight: 1, color: '#2C4A3E' }}>
              bodega bets
            </span>
          </Link>
        </div>

        <h1 className="font-display text-center mb-1" style={{ fontWeight: 700, fontSize: '28px', color: '#1A1A1A' }}>
          Rediger profil
        </h1>
        <p className="font-body text-center text-sm mb-8" style={{ color: '#5C5C4A' }}>
          Opdater dine oplysninger
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Brugernavn ─────────────────────────────────── */}
          <div>
            <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
              Brugernavn
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-body text-sm text-warm-gray">@</span>
              <input
                type="text"
                placeholder="dit_brugernavn"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={`${inputClass} pl-8 pr-20`}
              />
              {usernameChanged && usernameStatus === 'available' && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-condensed text-xs text-[#3D6B5A]" style={{ fontWeight: 700 }}>
                  ✓ Ledigt
                </span>
              )}
              {usernameChanged && usernameStatus === 'taken' && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-condensed text-xs text-[#C8392B]" style={{ fontWeight: 700 }}>
                  ✗ Optaget
                </span>
              )}
              {usernameChanged && usernameStatus === 'checking' && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-condensed text-xs text-warm-gray" style={{ fontWeight: 600 }}>
                  Tjekker…
                </span>
              )}
            </div>
            <p className="font-body text-warm-gray text-xs mt-1.5">Vises på leaderboard og i spilrum</p>
          </div>

          {/* ── E-mail (readonly) ──────────────────────────── */}
          <div>
            <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
              E-mail
            </label>
            <input
              type="email"
              value={userEmail}
              readOnly
              className={`${inputClass} bg-[#EDE8DF] text-[#5C5C4A] cursor-not-allowed`}
            />
            <p className="font-body text-warm-gray text-xs mt-1.5">E-mail kan ikke ændres herfra</p>
          </div>

          {/* ── Divider — Skift adgangskode ─────────────────── */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-[1px] bg-[#D4CFC4]" />
            <span className="font-condensed text-xs uppercase tracking-[0.06em] text-warm-gray whitespace-nowrap" style={{ fontWeight: 600 }}>
              Skift adgangskode
            </span>
            <div className="flex-1 h-[1px] bg-[#D4CFC4]" />
          </div>
          <p className="font-body text-warm-gray text-xs -mt-3">
            Udfyld kun hvis du vil ændre din adgangskode.
          </p>

          {/* ── Nuværende adgangskode ──────────────────────── */}
          <div>
            <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
              Nuværende adgangskode
            </label>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* ── Ny adgangskode ─────────────────────────────── */}
          <div>
            <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
              Ny adgangskode
            </label>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
            {newPassword.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1.5 mb-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-[3px] flex-1 rounded-full transition-colors"
                      style={{ background: i <= strength.level ? strength.color : '#D4CFC4' }}
                    />
                  ))}
                </div>
                <p className="font-body text-xs" style={{ color: strength.color }}>{strength.label}</p>
              </div>
            )}
          </div>

          {/* ── Notifikationer ──────────────────────────────── */}
          {'Notification' in globalThis && (
            <>
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-[1px] bg-[#D4CFC4]" />
                <span className="font-condensed text-xs uppercase tracking-[0.06em] text-warm-gray whitespace-nowrap" style={{ fontWeight: 600 }}>
                  Notifikationer
                </span>
                <div className="flex-1 h-[1px] bg-[#D4CFC4]" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-condensed text-xs uppercase tracking-[0.08em] text-ink" style={{ fontWeight: 600 }}>
                    Bet-deadline påmindelser
                  </p>
                  <p className="font-body text-warm-gray text-xs mt-0.5">
                    Få besked når deadline nærmer sig
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePushToggle}
                  disabled={pushLoading || pushToggling}
                  className="relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                  style={{ background: pushEnabled ? '#2C4A3E' : '#D4CFC4' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: pushEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            </>
          )}

          {/* ── Error ──────────────────────────────────────── */}
          {error && (
            <div className="bg-[#C8392B]/10 border border-[#C8392B]/30 text-[#C8392B] font-body text-sm rounded-sm px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Submit ─────────────────────────────────────── */}
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 font-condensed uppercase tracking-[0.08em] text-sm px-8 py-4 rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px]"
            style={{ fontWeight: 700, background: '#2C4A3E', color: '#F2EDE4' }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#1a3329' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2C4A3E' }}
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {saving ? 'Gemmer...' : 'Gem ændringer →'}
          </button>
        </form>

        {/* Footer link */}
        <p className="text-center font-body text-sm mt-6" style={{ color: '#5C5C4A' }}>
          <Link href="/dashboard" className="font-semibold hover:opacity-70 transition-opacity" style={{ color: '#1a3329' }}>
            ← Tilbage til dashboard
          </Link>
        </p>
      </div>
    </div>
  )
}
