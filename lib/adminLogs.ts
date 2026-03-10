import { supabaseAdmin } from '@/lib/supabase'

export type AdminLogType = 'cron_sync' | 'bold_api' | 'point_calc' | 'user_action'
export type AdminLogStatus = 'success' | 'error' | 'warning'

export async function logAdmin(
  type: AdminLogType,
  status: AdminLogStatus,
  message?: string,
  metadata?: Record<string, unknown>
) {
  await supabaseAdmin.from('admin_logs').insert({
    type,
    status,
    message: message ?? null,
    metadata: metadata ?? null,
  })
}
