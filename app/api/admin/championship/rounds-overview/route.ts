import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  // Hent alle ikke-finished rounds med sæson og turnering
  const { data: rounds, error } = await supabaseAdmin
    .from('rounds')
    .select('id, name, season_id, status, betting_closes_at, season:seasons!season_id(tournament:tournaments!tournament_id(id, name))')
    .neq('status', 'finished')
    .order('betting_closes_at', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const roundIds = (rounds ?? []).map((r) => r.id)
  if (roundIds.length === 0) return NextResponse.json({ rounds: [] })

  // Hent første og sidste kickoff per runde
  const { data: matchStats } = await supabaseAdmin
    .from('matches')
    .select('round_id, kickoff')
    .in('round_id', roundIds)
    .neq('status', 'cancelled')
    .order('kickoff', { ascending: true })

  const kickoffByRound = new Map<number, { first: string; last: string }>()
  for (const m of matchStats ?? []) {
    const rid = m.round_id as number
    const existing = kickoffByRound.get(rid)
    if (!existing) {
      kickoffByRound.set(rid, { first: m.kickoff, last: m.kickoff })
    } else {
      if (m.kickoff < existing.first) existing.first = m.kickoff
      if (m.kickoff > existing.last) existing.last = m.kickoff
    }
  }

  const result = (rounds ?? []).map((r) => {
    const season = r.season as unknown as { tournament: { id: number; name: string } | null } | null
    const kickoffs = kickoffByRound.get(r.id)
    return {
      id: r.id,
      name: r.name,
      season_id: r.season_id,
      status: r.status,
      tournament_name: season?.tournament?.name ?? null,
      tournament_id: season?.tournament?.id ?? null,
      first_kickoff: kickoffs?.first ?? null,
      last_kickoff: kickoffs?.last ?? null,
    }
  })

  return NextResponse.json({ rounds: result })
}
