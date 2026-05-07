import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data, error } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, first_name, last_name, team_name, category, photo_url, team_logo_url, pcs_slug')
    .order('category', { ascending: true })
    .order('last_name', { ascending: true })
    .limit(1000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ riders: data ?? [] })
}
