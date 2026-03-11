'use client'

import { useState, useRef, useEffect } from 'react'
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

export default function ProfileEditPage() {
  const router = useRouter()
  const { toast } = useToast()

  /* ── Loading state ─────────────────────────────────────── */
  const [pageLoading, setPageLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  /* ── Form state ────────────────────────────────────────── */
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /* ── Avatar state ──────────────────────────────────────── */
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Password state ────────────────────────────────────── */
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  /* ── Push notifications state ────────────────────────────── */
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(true)
  const [pushToggling, setPushToggling] = useState(false)

  /* ── Load profile data ─────────────────────────────────── */
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      setUserEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username ?? '')
        setOriginalUsername(profile.username ?? '')
        setAvatarUrl(profile.avatar_url ?? null)
        setAvatarPreview(profile.avatar_url ?? null)

        const fullName = (profile.full_name as string) ?? ''
        const parts = fullName.split(' ')
        if (parts.length >= 2) {
          setFirstName(parts[0])
          setLastName(parts.slice(1).join(' '))
        } else if (parts.length === 1) {
          setFirstName(parts[0])
        }
      }
      setPageLoading(false)

      // Check push subscription status
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
    }
    loadProfile()
  }, [router])

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

  /* ── Avatar handling ───────────────────────────────────── */
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Billedet må maks. være 2MB')
      return
    }
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

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
  const initials =
    [firstName[0], lastName[0]].filter(Boolean).map((c) => c.toUpperCase()).join('') ||
    (username[0]?.toUpperCase() ?? '?')

  /* ── Password strength ─────────────────────────────────── */
  const strength = getPasswordStrength(newPassword)

  /* ── Submit ────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!userId) return

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) return setError('Brugernavn skal være mindst 3 tegn')
    if (usernameChanged && usernameStatus === 'taken') return setError('Brugernavnet er allerede taget')

    // Validate password fields
    if (newPassword && !currentPassword) return setError('Indtast din nuværende adgangskode')
    if (newPassword && newPassword.length < 6) return setError('Ny adgangskode skal være mindst 6 tegn')

    setSaving(true)

    // Upload avatar if changed
    let newAvatarUrl = avatarUrl
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const filePath = `${userId}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true })

      if (uploadError) {
        setSaving(false)
        return setError('Kunne ikke uploade billede: ' + uploadError.message)
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      if (urlData?.publicUrl) {
        newAvatarUrl = urlData.publicUrl
      }
    }

    // Update profile
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        username: trimmedUsername,
        full_name: fullName || null,
        avatar_url: newAvatarUrl,
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
    setAvatarFile(null)
    setCurrentPassword('')
    setNewPassword('')
    toast('Profil opdateret ✓', 'success')
    router.refresh()
  }

  /* ── Input classes ─────────────────────────────────────── */
  const inputClass =
    'w-full bg-white border-[1.5px] border-[#D4CFC4] text-[#1A1A1A] placeholder-[#5C5C4A]/50 rounded-sm px-4 py-3 font-body text-sm outline-none focus:border-[#1a3329] transition-colors min-h-[44px]'

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a3329' }}>
        <div className="font-condensed text-[#F2EDE4]/50 text-sm uppercase tracking-widest">Indlæser...</div>
      </div>
    )
  }

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
          Rediger profil
        </h1>
        <p className="font-body text-center text-sm mb-8" style={{ color: '#5C5C4A' }}>
          Opdater dine oplysninger
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Avatar upload ──────────────────────────────── */}
          <div
            className="flex items-center gap-4 p-4 rounded-sm border-[1.5px] border-dashed border-[#D4CFC4] bg-[#EDE8DF] cursor-pointer hover:border-[#B8963E] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className="shrink-0 w-16 h-16 rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: '#2C4A3E' }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-condensed text-cream text-lg" style={{ fontWeight: 700 }}>
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-condensed text-ink text-xs uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 700 }}>
                Profilbillede
              </p>
              <p className="font-body text-warm-gray text-xs">
                Klik for at ændre · JPG/PNG · Maks 2MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* ── Fornavn + Efternavn ────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
                Fornavn
              </label>
              <input
                type="text"
                placeholder="Anders"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
                Efternavn
              </label>
              <input
                type="text"
                placeholder="Jensen"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

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
