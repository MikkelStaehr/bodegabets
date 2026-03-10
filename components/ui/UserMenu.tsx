'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

type Props = {
  username: string
  points: number
  isAdmin?: boolean
}

const supabase = createBrowserSupabaseClient()

export default function UserMenu({ username, points, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div ref={ref} className="relative flex items-center gap-3">
      {/* Point badge */}
      <div className="font-condensed font-bold text-sm text-gold tracking-wide hidden sm:block">
        {points.toLocaleString('da-DK')} <span className="opacity-60">PT</span>
      </div>

      {/* Avatar/navn knap */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 font-condensed font-semibold text-sm uppercase tracking-[0.06em] text-cream/80 hover:text-cream transition-colors"
      >
        <div className="w-7 h-7 bg-forest-light flex items-center justify-center text-xs font-bold text-gold shrink-0">
          {username[0].toUpperCase()}
        </div>
        <span className="hidden sm:block">{username}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-warm-border z-50"
          style={{ borderRadius: '2px' }}
        >
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 font-condensed text-xs uppercase tracking-[0.08em] text-ink hover:bg-cream transition-colors border-b border-warm-border"
          >
            Profil
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 font-condensed text-xs uppercase tracking-[0.08em] text-ink hover:bg-cream transition-colors border-b border-warm-border"
          >
            Dashboard
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-3 font-condensed text-xs uppercase tracking-[0.08em] text-gold hover:bg-cream transition-colors border-b border-warm-border"
            >
              Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-2 px-4 py-3 font-condensed text-xs uppercase tracking-[0.08em] text-vintage-red hover:bg-cream transition-colors"
          >
            Log ud
          </button>
        </div>
      )}
    </div>
  )
}
