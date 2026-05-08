import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Sign-out via dedikeret route. Bruges fra UserMenu så vi kan navigere
 * via en Link (mere pålidelig end async button-handler under AAL2-state).
 *
 * Server-side: kalder signOut og clearer session-cookies, redirecter til /.
 */
export default async function LogoutPage() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut().catch(() => {
    // Hvis server-signOut fejler, skipper vi — cookies bliver ryddet alligevel
  })
  redirect('/')
}
