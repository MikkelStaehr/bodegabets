import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { sendEmail } from '@/lib/email'
import { testEmail } from '@/lib/emailTemplates'
import { logAudit } from '@/lib/auditLog'

/**
 * POST /api/admin/email-test
 *
 * Sender en test-mail for at verificere Resend-opsætningen.
 * Body: { to: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({})) as { to?: string }
  const to = body.to?.trim()
  if (!to) return NextResponse.json({ error: 'Email-adresse mangler' }, { status: 400 })

  const tmpl = testEmail({ recipientEmail: to })
  const result = await sendEmail({
    to,
    subject: tmpl.subject,
    html: tmpl.html,
    tags: [{ name: 'category', value: 'admin-test' }],
  })

  await logAudit(req, {
    action: 'admin.email_test',
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    metadata: { to, ok: result.ok, error: result.error, message_id: result.id },
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Send fejlede' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.id })
}
