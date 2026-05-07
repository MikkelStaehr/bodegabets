import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

/**
 * DELETE /api/users/me/delete
 *
 * GDPR right-to-erasure: sletter brugerens auth-record + relaterede data.
 * Cascade FKs på de fleste tabeller fjerner data automatisk.
 * Bruger admin-API til at slette auth.users rækken (ellers kan
 * Supabase ikke slette egen account).
 */
export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const userId = user.id

  // 1. Slet relaterede data der ikke har CASCADE FK til auth.users
  //    (de fleste cascader fra games/profiles, men profiles selv er ikke
  //    auto-slettet ved auth.users delete i Supabase som standard)
  try {
    // Slet profile (cascader til alle public.* tabeller via FKs hvor relevant)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    // Slet push subscriptions hvis tabellen har dem
    await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId).throwOnError()
  } catch {
    // Tabel findes muligvis ikke — fortsæt
  }

  // 2. Slet auth.users via admin-API (kræver service role)
  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  // 3. Sign out fra denne session
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
