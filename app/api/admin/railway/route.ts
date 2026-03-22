import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { endpoint } = await req.json()
  const railwayUrl = process.env.RAILWAY_URL ?? 'https://bodegabets-production.up.railway.app'

  // Send kaldet til Railway men vent ikke på svar
  fetch(`${railwayUrl}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  }).catch(() => {}) // ignorer fejl — Railway logger dem selv

  // Returner med det samme
  return NextResponse.json({ ok: true, message: 'Job startet på Railway — tjek Railway logs for status' })
}
