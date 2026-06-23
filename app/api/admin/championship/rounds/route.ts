import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const season = new URL(req.url).searchParams.get('season') ?? '2025/26'

  let query = supabaseAdmin
    .from('championship_rounds')
    .select('id, name, status, betting_closes_at, season')
    .order('betting_closes_at', { ascending: true })

  if (season) query = query.eq('season', season)

  const { data: rounds, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hent kampe per runde
  const roundIds = (rounds ?? []).map((r) => r.id)
  const { data: roundMatches } = roundIds.length > 0
    ? await supabaseAdmin
        .from('championship_round_matches')
        .select('championship_round_id, match_id, matches:match_id(id, kickoff, status, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name))')
        .in('championship_round_id', roundIds)
    : { data: [] }

  const matchesByRound = new Map<number, typeof roundMatches>()
  for (const rm of roundMatches ?? []) {
    const rid = rm.championship_round_id as number
    if (!matchesByRound.has(rid)) matchesByRound.set(rid, [])
    matchesByRound.get(rid)!.push(rm)
  }

  const result = (rounds ?? []).map((r) => ({
    ...r,
    matches: (matchesByRound.get(r.id) ?? []).map((rm) => {
      const m = rm.matches as unknown as {
        id: number
        kickoff: string
        status: string
        home_team: { name: string } | null
        away_team: { name: string } | null
      }
      return {
        id: m.id,
        kickoff: m.kickoff,
        status: m.status,
        home_team: m.home_team?.name ?? '?',
        away_team: m.away_team?.name ?? '?',
      }
    }),
  }))

  return NextResponse.json({ rounds: result })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { name, betting_closes_at, match_ids, season } = body as {
    name: string
    betting_closes_at: string
    match_ids: number[]
    season?: string
  }

  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 })
  if (!match_ids?.length) return NextResponse.json({ error: 'Vælg mindst én kamp' }, { status: 400 })
  if (match_ids.length > 9) return NextResponse.json({ error: 'Maks 9 kampe per runde' }, { status: 400 })

  // Opret runde. `season` SKAL med — ellers falder den tilbage til DB-default
  // og forsvinder fra den sæson admin arbejder i (gemme = slet + genopret).
  const { data: round, error: roundError } = await supabaseAdmin
    .from('championship_rounds')
    .insert({
      name: name.trim(),
      status: 'upcoming',
      betting_closes_at: betting_closes_at || null,
      ...(season ? { season } : {}),
    })
    .select('id')
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: roundError?.message ?? 'Kunne ikke oprette runde' }, { status: 500 })
  }

  // Tilknyt kampe
  const matchRows = match_ids.map((matchId) => ({
    championship_round_id: round.id,
    match_id: matchId,
  }))

  const { error: matchError } = await supabaseAdmin
    .from('championship_round_matches')
    .insert(matchRows)

  if (matchError) {
    // Cleanup: slet runden igen
    await supabaseAdmin.from('championship_rounds').delete().eq('id', round.id)
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, round_id: round.id })
}
