/**
 * Admin-auth for API route handlers.
 * Understøtter både session (cookies) og Bearer token (ADMIN_SECRET).
 * Session-baseret auth bruger getUser() som fungerer bedre i route handlers.
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

/**
 * Tjekker om request er fra admin.
 * Returnerer { ok: true } eller { ok: false, response }.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ ok: boolean; response: NextResponse<unknown> }> {
  // 1. Bearer token (cron, scripts, backwards compat)
  if (isBearerAuthorized(req)) {
    return { ok: true, response: NextResponse.json({ ok: true }) }
  }

  // 2. Session fra cookies (browser, admin panel)
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
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

  return { ok: true, response: NextResponse.json({ ok: true }) }
}
