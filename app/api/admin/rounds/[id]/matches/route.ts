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

  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('season_id, name')
    .eq('id', roundId)
    .single()
  if (!round) return NextResponse.json({ error: 'Runde ikke fundet' }, { status: 404 })

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('id, home_team_id, away_team_id, kickoff, status, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
    .eq('season_id', round.season_id)
    .eq('round_name', round.name)
    .order('kickoff', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = (matches ?? []).map((m) => {
    const ht = (m as { home_team?: { name?: string } | { name?: string }[] }).home_team
    const at = (m as { away_team?: { name?: string } | { name?: string }[] }).away_team
    return {
      id: m.id,
      home_team: (Array.isArray(ht) ? ht[0] : ht)?.name ?? '—',
      away_team: (Array.isArray(at) ? at[0] : at)?.name ?? '—',
      kickoff_at: (m as { kickoff?: string }).kickoff,
      status: m.status,
    }
  })

  return NextResponse.json({ matches: list })
}
