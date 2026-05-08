import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0')
  const action = req.nextUrl.searchParams.get('action')
  const actorId = req.nextUrl.searchParams.get('actor_id')

  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, actor_id, actor_email, action, target_table, target_id, before, after, metadata, ip, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) query = query.eq('action', action)
  if (actorId) query = query.eq('actor_id', actorId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [] })
}
