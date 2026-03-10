import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, username, created_at, is_suspended')
    .order('created_at', { ascending: false })

  if (!profiles?.length) {
    return NextResponse.json({ users: [] })
  }

  const ids = profiles.map((p) => p.id)

  const [{ data: authUsers }, { data: memberships }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers(),
    supabaseAdmin
      .from('game_members')
      .select('user_id, game_id')
      .in('user_id', ids),
  ])

  const gamesByUser = new Map<string, number>()
  for (const m of memberships ?? []) {
    const uid = (m as { user_id: string }).user_id
    gamesByUser.set(uid, (gamesByUser.get(uid) ?? 0) + 1)
  }

  const emailById = new Map<string, string>()
  for (const u of authUsers?.users ?? []) {
    emailById.set(u.id, u.email ?? '')
  }

  const users = profiles.map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? '',
    username: p.username ?? '—',
    created_at: p.created_at,
    games_count: gamesByUser.get(p.id) ?? 0,
    last_active: null as string | null,
    is_suspended: p.is_suspended ?? false,
  }))

  return NextResponse.json({ users })
}
