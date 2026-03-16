/**
 * Admin-auth for API route handlers.
 * Auth sker udelukkende via Supabase session (cookies).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Tjekker om request er fra admin.
 * Returnerer { ok: true } eller { ok: false, response }.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ ok: boolean; response: NextResponse<unknown> }> {
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

  if (!profile?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, response: NextResponse.json({ ok: true }) }
}