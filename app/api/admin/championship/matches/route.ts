import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const tournamentId = url.searchParams.get('tournament_id')

  if (!from || !to) {
    return NextResponse.json({ error: 'from og to parametre er påkrævet' }, { status: 400 })
  }

  console.log('[championship/matches] from:', from, 'to:', to)

  // Hent kampe i tidsvindue
  let query = supabaseAdmin
    .from('matches')
    .select(`
      id, kickoff, status, round_id, season_id,
      home_team:teams!home_team_id(id, name),
      away_team:teams!away_team_id(id, name),
      season:seasons!season_id(tournament:tournaments!tournament_id(id, name, logo_url))
    `)
    .gte('kickoff', from)
    .lte('kickoff', to)
    .neq('status', 'cancelled')
    .order('kickoff', { ascending: true })

  if (tournamentId) {
    // Filter via season → tournament
    const { data: seasonRows } = await supabaseAdmin
      .from('seasons')
      .select('id')
      .eq('tournament_id', parseInt(tournamentId))
    const seasonIds = (seasonRows ?? []).map((s) => s.id)
    if (seasonIds.length > 0) {
      query = query.in('season_id', seasonIds)
    } else {
      return NextResponse.json({ matches: [] })
    }
  }

  const { data: matches, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hent rivalries
  const allTeamIds = [...new Set(
    (matches ?? []).flatMap((m) => {
      const ht = m.home_team as unknown as { id: number } | null
      const at = m.away_team as unknown as { id: number } | null
      return [ht?.id, at?.id].filter((id): id is number => id != null)
    })
  )]

  const rivalrySet = new Set<string>()
  const rivalryNames = new Map<string, string>()
  if (allTeamIds.length > 0) {
    const { data: rivalries } = await supabaseAdmin
      .from('rivalries')
      .select('team_id, rival_team_id, rivalry_name')
      .in('team_id', allTeamIds)
      .in('rival_team_id', allTeamIds)
    for (const r of rivalries ?? []) {
      const key = [r.team_id, r.rival_team_id].sort().join(':')
      rivalrySet.add(key)
      rivalryNames.set(key, r.rivalry_name)
    }
  }

  const result = (matches ?? []).map((m) => {
    const ht = m.home_team as unknown as { id: number; name: string } | null
    const at = m.away_team as unknown as { id: number; name: string } | null
    if ((ht?.name?.includes('Atlético') || ht?.name?.includes('Atletico')) && (at?.name?.includes('Barcelona') || at?.name?.includes('Barça'))) {
      console.log('[championship/matches] Atletico-Barcelona kickoff:', m.kickoff, 'id:', m.id)
    }
    const season = m.season as unknown as { tournament: { id: number; name: string; logo_url: string | null } | null } | null
    const rivalryKey = ht && at ? [ht.id, at.id].sort().join(':') : null
    const isRivalry = rivalryKey ? rivalrySet.has(rivalryKey) : false
    return {
      id: m.id,
      kickoff: m.kickoff,
      status: m.status,
      home_team: ht?.name ?? '?',
      away_team: at?.name ?? '?',
      tournament_name: season?.tournament?.name ?? null,
      tournament_logo: season?.tournament?.logo_url ?? null,
      tournament_id: season?.tournament?.id ?? null,
      is_rivalry: isRivalry,
      rivalry_name: rivalryKey ? (rivalryNames.get(rivalryKey) ?? null) : null,
    }
  })

  // Hent alle turneringer for filter-dropdown
  const { data: tournaments } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, logo_url')
    .order('name')

  return NextResponse.json({ matches: result, tournaments: tournaments ?? [] })
}
