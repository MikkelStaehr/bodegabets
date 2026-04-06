import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const raceId = parseInt(id, 10)
  if (isNaN(raceId)) {
    return NextResponse.json({ error: 'Invalid race id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, stage_number, name, profile, start_date, results_uploaded_at')
    .eq('race_id', raceId)
    .order('stage_number', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ stages: data ?? [] })
}
