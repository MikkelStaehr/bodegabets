/**
 * Admin-auth for API route handlers.
 * Understøtter både session (cookies) og Bearer token (ADMIN_SECRET).
 * Session-baseret auth bruger getUser() som validerer JWT mod Supabase serveren.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean)

function isBearerAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`
}

export type AdminAuthResult =
  | { ok: true; response: NextResponse<unknown>; actor: { id: string | null; email: string | null } }
  | { ok: false; response: NextResponse<unknown>; actor?: undefined }

/**
 * Tjekker om request er fra admin.
 * Returnerer { ok: true, actor } eller { ok: false, response }.
 * Actor.id er null for Bearer-token requests (cron, scripts).
 */
export async function requireAdmin(req: NextRequest): Promise<AdminAuthResult> {
  // 1. Bearer token (cron, scripts, backwards compat)
  if (isBearerAuthorized(req)) {
    return {
      ok: true,
      response: NextResponse.json({ ok: true }),
      actor: { id: null, email: 'bearer-token' },
    }
  }

  // 2. Auth fra cookies (browser, admin panel)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin =
    profile?.is_admin === true || ADMIN_EMAILS.includes(user.email ?? '')

  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  // AAL2-enforcement er midlertidigt fjernet (step-up flow virkede ikke
  // pålideligt). Genaktivér ved at indsætte mfa.getAuthenticatorAssuranceLevel-
  // tjek her hvis 2FA-på-admin skal tilbage.

  return {
    ok: true,
    response: NextResponse.json({ ok: true }),
    actor: { id: user.id, email: user.email ?? null },
  }
}
