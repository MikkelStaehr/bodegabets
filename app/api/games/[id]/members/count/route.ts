import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { count } = await supabaseAdmin
    .from('game_members')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)

  return NextResponse.json({ memberCount: count ?? 0 })
}
