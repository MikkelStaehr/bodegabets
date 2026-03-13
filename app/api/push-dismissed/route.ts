import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

// GET — hent push_dismissed status for nuværende bruger
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('push_dismissed')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ push_dismissed: profile?.push_dismissed ?? false })
}

// POST — sæt push_dismissed = true for nuværende bruger
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ push_dismissed: true })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}