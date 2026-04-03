import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data: games, error } = await supabaseAdmin
    .from('games')
    .select('id, name, invite_code, status, created_at, game_members(count)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = (games ?? []).map((g) => {
    const memberCount = Array.isArray(g.game_members)
      ? (g.game_members[0] as { count: number })?.count ?? 0
      : 0
    return {
      id: g.id,
      name: g.name,
      invite_code: g.invite_code,
      status: g.status,
      created_at: g.created_at,
      member_count: memberCount,
    }
  })

  return NextResponse.json({ games: list })
}
