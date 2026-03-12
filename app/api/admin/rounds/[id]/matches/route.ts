import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const roundId = parseInt(id)
  if (isNaN(roundId)) {
    return NextResponse.json({ error: 'Ugyldigt round_id' }, { status: 400 })
  }

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, kickoff_at, status')
    .eq('round_id', roundId)
    .order('kickoff_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = (matches ?? []).map((m) => ({
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
    kickoff_at: m.kickoff_at,
    status: m.status,
  }))

  return NextResponse.json({ matches: list })
}
