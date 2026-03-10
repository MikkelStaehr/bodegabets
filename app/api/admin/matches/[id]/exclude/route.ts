import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const matchId = parseInt(id)
  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'Ugyldigt match_id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as { excluded?: boolean; reason?: string }
  const excluded = body.excluded ?? true

  const { error } = await supabaseAdmin
    .from('matches')
    .update({
      is_excluded: excluded,
      excluded_reason: excluded ? (body.reason ?? 'Undtaget af admin') : null,
      excluded_at: excluded ? new Date().toISOString() : null,
    })
    .eq('id', matchId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, excluded })
}
