'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="font-condensed font-semibold text-xs uppercase tracking-[0.08em] border border-vintage-red text-vintage-red px-5 py-2.5 hover:bg-vintage-red hover:text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ borderRadius: '2px' }}
    >
      {loading ? 'Logger ud…' : 'Log ud'}
    </button>
  )
}
