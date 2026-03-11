'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

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

export default function RegisterPage() {
  const router = useRouter()

  /* ── Form state ──────────────────────────────────────────── */
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /* ── Avatar state ────────────────────────────────────────── */
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Username availability ───────────────────────────────── */
  const debouncedUsername = useDebounce(username.trim(), 500)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  useEffect(() => {
    if (debouncedUsername.length < 3) {
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
  }, [debouncedUsername])

  /* ── Invite code validation ──────────────────────────────── */
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [inviteGame, setInviteGame] = useState<{ id: number; name: string; members: number } | null>(null)

  const checkInviteCode = useCallback(async () => {
    const code = inviteCode.trim().toUpperCase()
    if (code.length < 4) return
    setInviteStatus('checking')
    const { data } = await supabase
      .from('games')
      .select('id, name, game_members(count)')
      .eq('invite_code', code)
      .limit(1)
      .single()

    if (data) {
      const memberCount = Array.isArray(data.game_members)
        ? (data.game_members[0] as { count: number })?.count ?? 0
        : 0
      setInviteGame({ id: data.id, name: data.name, members: memberCount })
      setInviteStatus('valid')
    } else {
      setInviteGame(null)
      setInviteStatus('invalid')
    }
  }, [inviteCode])

  /* ── Avatar handling ─────────────────────────────────────── */
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

  /* ── Initials ────────────────────────────────────────────── */
  const initials =
    [firstName[0], lastName[0]].filter(Boolean).map((c) => c.toUpperCase()).join('') || '?'

  /* ── Password strength ───────────────────────────────────── */
  const strength = getPasswordStrength(password)

  /* ── Submit ──────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) return setError('Brugernavn skal være mindst 3 tegn')
    if (password.length < 6) return setError('Adgangskode skal være mindst 6 tegn')
    if (usernameStatus === 'taken') return setError('Brugernavnet er allerede taget')

    setLoading(true)

    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')

    // Opret auth-bruger — brugernavn sendes som metadata og oprettes via trigger
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: trimmedUsername,
          ...(fullName ? { full_name: fullName } : {}),
        },
      },
    })

    if (signUpError) {
      setLoading(false)
      if (signUpError.message.includes('already registered')) return setError('Denne email er allerede i brug')
      return setError(signUpError.message)
    }

    // Upload avatar if selected
    if (avatarFile && signUpData.user) {
      const ext = avatarFile.name.split('.').pop()
      const filePath = `${signUpData.user.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true })

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
        if (urlData?.publicUrl) {
          await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', signUpData.user.id)
        }
      }
    }

    // Join game if valid invite code
    if (inviteStatus === 'valid' && inviteGame && signUpData.user) {
      await supabase.from('game_members').insert({ game_id: inviteGame.id, user_id: signUpData.user.id })
      router.push(`/games/${inviteGame.id}`)
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  /* ── Input classes ───────────────────────────────────────── */
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

      {/* Register kort */}
      <div
        className="relative w-full max-w-[480px] rounded-sm p-8 sm:p-10"
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
          Opret konto
        </h1>
        <p className="font-body text-center text-sm mb-8" style={{ color: '#5C5C4A' }}>
          Gratis — ingen kreditkort nødvendigt
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
                  Klik for at uploade · JPG/PNG · Maks 2MB
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
                {usernameStatus === 'available' && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-condensed text-xs text-[#3D6B5A]" style={{ fontWeight: 700 }}>
                    ✓ Ledigt
                  </span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-condensed text-xs text-[#C8392B]" style={{ fontWeight: 700 }}>
                    ✗ Optaget
                  </span>
                )}
                {usernameStatus === 'checking' && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-condensed text-xs text-warm-gray" style={{ fontWeight: 600 }}>
                    Tjekker…
                  </span>
                )}
              </div>
              <p className="font-body text-warm-gray text-xs mt-1.5">Vises på leaderboard og i spilrum</p>
            </div>

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
              <label className="block font-condensed text-xs uppercase tracking-[0.08em] text-ink mb-1.5" style={{ fontWeight: 600 }}>
                Adgangskode
              </label>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
              {/* Strength bars */}
              {password.length > 0 && (
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

            {/* ── Divider — invitationskode ───────────────────── */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-[1px] bg-[#D4CFC4]" />
              <span className="font-condensed text-xs uppercase tracking-[0.06em] text-warm-gray whitespace-nowrap" style={{ fontWeight: 600 }}>
                Har du en invitationskode?
              </span>
              <div className="flex-1 h-[1px] bg-[#D4CFC4]" />
            </div>
            <p className="font-body text-warm-gray text-xs -mt-3">
              Koden finder du i det spilrum din ven har delt med dig.
            </p>

            {/* ── Invitationskode felt ────────────────────────── */}
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ABC123"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase())
                    setInviteStatus('idle')
                    setInviteGame(null)
                  }}
                  className={`${inputClass} flex-1 text-center uppercase tracking-[0.2em] font-condensed`}
                  style={{ fontWeight: 700 }}
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={checkInviteCode}
                  disabled={inviteCode.trim().length < 4}
                  className="font-condensed text-xs uppercase tracking-[0.08em] px-5 py-3 rounded-sm border-[1.5px] border-[#D4CFC4] text-ink hover:border-[#1a3329] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px]"
                  style={{ fontWeight: 700 }}
                >
                  Tjek
                </button>
              </div>
              {inviteStatus === 'valid' && inviteGame && (
                <p className="font-body text-xs text-[#3D6B5A] mt-2" style={{ fontWeight: 500 }}>
                  ✓ {inviteGame.name} — {inviteGame.members} deltager{inviteGame.members !== 1 ? 'e' : ''}
                </p>
              )}
              {inviteStatus === 'invalid' && (
                <p className="font-body text-xs text-[#C8392B] mt-2" style={{ fontWeight: 500 }}>
                  ✗ Ugyldig kode — tjek at du har skrevet den rigtigt
                </p>
              )}
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
              {loading
                ? 'Opretter konto...'
                : inviteStatus === 'valid'
                ? 'Opret konto og join spilrum →'
                : 'Opret konto →'}
            </button>
          </form>

        {/* Footer links */}
        <p className="text-center font-body text-sm mt-6" style={{ color: '#5C5C4A' }}>
          Har du allerede en konto?{' '}
          <Link href="/login" className="font-semibold hover:opacity-70 transition-opacity" style={{ color: '#1a3329' }}>
            Log ind her
          </Link>
        </p>

        <p className="text-center font-body text-xs mt-4 leading-relaxed" style={{ color: 'rgba(92,92,74,0.6)' }}>
          Ved at oprette en konto accepterer du vores vilkår.
          Bodega Bets involverer aldrig rigtige penge.
        </p>
      </div>
    </div>
  )
}
