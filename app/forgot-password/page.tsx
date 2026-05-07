'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) return
    setSubmitting(true)

    const supabase = createBrowserSupabaseClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  const inputClass =
    'w-full px-4 py-3 rounded-sm border border-[#D4CEC4] bg-white font-body text-base focus:outline-none focus:border-[#1a3329] transition-colors'

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-3xl font-bold text-[#1a3329] mb-4">
            Tjek din mail
          </h1>
          <p className="font-body text-[#5C5C4A] mb-6">
            Hvis der er en konto knyttet til <strong>{email}</strong>,
            har vi sendt et link så du kan vælge en ny adgangskode.
          </p>
          <p className="font-body text-sm text-[#7a7060] mb-8">
            Linket virker i 1 time. Tjek evt. din spam-mappe.
          </p>
          <Link
            href="/login"
            className="font-condensed text-sm uppercase tracking-[0.08em] font-bold text-[#1a3329] hover:opacity-70"
          >
            Tilbage til login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="font-condensed text-xs uppercase tracking-[0.08em] text-[#5C5C4A] hover:text-[#1a3329] mb-6 inline-block"
        >
          ← Tilbage
        </Link>

        <h1 className="font-display text-3xl font-bold text-[#1a3329] mb-2">
          Glemt adgangskode?
        </h1>
        <p className="font-body text-[#5C5C4A] mb-8">
          Indtast din email, så sender vi dig et link til at nulstille adgangskoden.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-condensed text-xs uppercase tracking-[0.08em] block mb-1.5" style={{ fontWeight: 600, color: '#1A1A1A' }}>
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
            disabled={submitting || !email.trim()}
            className="w-full px-6 py-3 rounded-sm bg-[#1a3329] text-[#F2EDE4] font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-[#2c4a3e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Sender...' : 'Send reset-link'}
          </button>
        </form>
      </div>
    </div>
  )
}
