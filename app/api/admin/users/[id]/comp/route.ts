import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/auditLog'

/**
 * Toggler whitelist-status (comped) på en bruger.
 *
 * Comp ON  → subscription_status = 'comped' (gratis adgang)
 * Comp OFF → subscription_status = 'none'   (paywall aktiveres igen)
 *
 * Vigtigt: hvis brugeren har en aktiv Stripe-subscription røres den ikke.
 * Comp er en lokal override og bør kun bruges på brugere uden Stripe-flow.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { comp?: boolean }
  const comp = body.comp ?? true

  const { data: before } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, stripe_subscription_id, username')
    .eq('id', id)
    .single()

  if (before?.stripe_subscription_id && !comp) {
    return NextResponse.json(
      { error: 'Brugeren har en aktiv Stripe-subscription — kan ikke fjerne comp her' },
      { status: 400 },
    )
  }

  const newStatus = comp ? 'comped' : 'none'
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ subscription_status: newStatus })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(req, {
    action: comp ? 'user.comp_grant' : 'user.comp_revoke',
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    targetTable: 'profiles',
    targetId: id,
    before: { subscription_status: before?.subscription_status ?? null },
    after: { subscription_status: newStatus },
    metadata: { username: before?.username },
  })

  return NextResponse.json({ ok: true, subscription_status: newStatus })
}
