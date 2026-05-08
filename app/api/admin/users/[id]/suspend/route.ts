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
  const body = await req.json().catch(() => ({})) as { suspend?: boolean; reason?: string }
  const suspend = body.suspend ?? true

  // Hent before-state for audit log
  const { data: before } = await supabaseAdmin
    .from('profiles')
    .select('is_suspended, suspended_reason, username')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      is_suspended: suspend,
      suspended_at: suspend ? new Date().toISOString() : null,
      suspended_reason: suspend ? (body.reason ?? 'Suspenderet af admin') : null,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(req, {
    action: suspend ? 'user.suspend' : 'user.unsuspend',
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    targetTable: 'profiles',
    targetId: id,
    before: { is_suspended: before?.is_suspended, suspended_reason: before?.suspended_reason },
    after: { is_suspended: suspend, suspended_reason: suspend ? (body.reason ?? 'Suspenderet af admin') : null },
    metadata: { username: before?.username },
  })

  return NextResponse.json({ ok: true, suspended: suspend })
}
