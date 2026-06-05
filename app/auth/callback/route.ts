import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * Auth callback for Supabase magic links (password reset, signup confirm,
 * magic link login).
 *
 * @supabase/ssr bruger PKCE-flow: emails sendt af Supabase peger til vores
 * `/auth/callback?code=<exchange-code>&next=<redirect-path>`. Vi udveksler
 * koden for en session og redirecter brugeren videre.
 *
 * Uden denne route returnerede Next.js 404 → "Linket eksisterer ikke længere".
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    // Ingen code-parameter → ugyldigt link, send til login med fejl
    return NextResponse.redirect(`${origin}/login?error=auth_callback_no_code`)
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Whitelist next-param (forhindrer open-redirect)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
