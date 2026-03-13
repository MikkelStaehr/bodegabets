import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

const VALID_TYPES = ['sync_scores', 'sync_fixtures', 'update_rounds', 'calculate_points', 'send_reminders', 'railway_ping', 'bold_api', 'point_calc', 'user_action']

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const typeParam = searchParams.get('type')
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10) || 50)

  const typeValue = typeParam && VALID_TYPES.includes(typeParam) ? typeParam : ''

  let query = supabaseAdmin
    .from('admin_logs')
    .select('id, type, status, message, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (typeValue) {
    query = query.eq('type', typeValue)
  }

  const { data: logs, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: logs ?? [] })
}
