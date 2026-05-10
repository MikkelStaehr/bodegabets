/**
 * Shared data fetchers for landing-related pages (/ og /landing-v2).
 * Brug supabaseAdmin (service role) — kun for offentligt-aggregerede tal.
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * Tæller brugere med login indenfor de seneste 30 dage. Returnerer null
 * hvis kaldet fejler — landing-UI skjuler indikatoren ved null/<10.
 */
export async function getActiveUserCount(): Promise<number | null> {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const users = (data?.users ?? []) as Array<{ last_sign_in_at?: string | null }>
    if (users.length === 0) return null
    return users.filter((u) => {
      const last = u.last_sign_in_at
      return last ? new Date(last).getTime() > cutoff : false
    }).length
  } catch {
    return null
  }
}
