'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'bb-cookie-consent'

export default function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (!v) setShow(true)
    } catch {
      // localStorage utilgængelig (privat browsing osv) — vis ikke banner
    }
  }, [])

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        accepted: true,
        at: new Date().toISOString(),
      }))
    } catch {
      // ignorer
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie-besked"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3 border-t"
      style={{
        background: '#0F2137',
        borderColor: 'rgba(242,237,228,0.1)',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.2)',
      }}
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <p
          className="font-body text-sm flex-1 leading-snug"
          style={{ color: '#F2EDE4' }}
        >
          Vi bruger nødvendige cookies til login og dine indstillinger. Vi sælger ikke data og bruger ikke 3.-parts trackere.{' '}
          <Link
            href="/cookie-politik"
            className="underline hover:no-underline"
            style={{ color: '#FAC775' }}
          >
            Læs mere
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="px-5 py-2 rounded-sm font-condensed font-bold text-xs uppercase tracking-[0.08em] flex-shrink-0 transition-colors"
          style={{ background: '#FAC775', color: '#1A1A1A' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5b94a' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FAC775' }}
        >
          OK, jeg forstår
        </button>
      </div>
    </div>
  )
}
