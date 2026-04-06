import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id, status } = await req.json()

  if (!id || !['upcoming', 'active', 'finished'].includes(status)) {
    return NextResponse.json(
      { error: 'Invalid id or status' },
      { status: 400 },
    )
  }

  const { error } = await supabaseAdmin
    .from('cycling_races')
    .update({ status })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
