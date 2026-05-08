/**
 * audit log helpers — kald fra admin-mutation endpoints.
 *
 * Bruges:
 *   await logAudit(req, {
 *     action: 'user.suspend',
 *     actorId: user.id,
 *     actorEmail: user.email,
 *     targetTable: 'profiles',
 *     targetId: targetUserId,
 *     before: { is_suspended: false },
 *     after: { is_suspended: true, suspended_reason: 'spam' },
 *   })
 */

import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export type AuditEntry = {
  action: string
  actorId?: string | null
  actorEmail?: string | null
  targetTable?: string | null
  targetId?: string | number | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export async function logAudit(req: NextRequest | Request | null, entry: AuditEntry): Promise<void> {
  try {
    const headers = req?.headers
    const ip = headers?.get('x-forwarded-for')?.split(',')[0].trim()
      ?? headers?.get('x-real-ip')
      ?? null
    const userAgent = headers?.get('user-agent') ?? null

    await supabaseAdmin.from('audit_logs').insert({
      action: entry.action,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId != null ? String(entry.targetId) : null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? null,
      ip,
      user_agent: userAgent,
    })
  } catch (err) {
    // Audit-log fejl må ikke crashe selve handlingen — log bare
    console.error('[auditLog] failed to write entry:', err)
  }
}
