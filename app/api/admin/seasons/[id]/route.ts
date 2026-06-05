import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/auditLog'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const seasonId = parseInt(id, 10)
  if (!seasonId) {
    return NextResponse.json({ error: 'Ugyldigt sæson-ID' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as {
    bold_phase_ids?: string | null
    is_active?: boolean
    is_free_event?: boolean
    start_date?: string | null
    end_date?: string | null
  }

  const updates: Record<string, unknown> = {}
  if ('bold_phase_ids' in body) updates.bold_phase_ids = body.bold_phase_ids ?? null
  if ('is_active' in body) updates.is_active = body.is_active
  if ('is_free_event' in body) updates.is_free_event = body.is_free_event
  if ('start_date' in body) updates.start_date = body.start_date ?? null
  if ('end_date' in body) updates.end_date = body.end_date ?? null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Ingen felter at opdatere' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('seasons')
    .update(updates)
    .eq('id', seasonId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(req, {
    action: 'season.update',
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    targetTable: 'seasons',
    targetId: seasonId,
    after: updates,
  })

  return NextResponse.json({ ok: true, season: data })
}
