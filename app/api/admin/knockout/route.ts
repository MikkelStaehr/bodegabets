import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/auditLog'
import { calculateRoundPoints } from '@/lib/calculatePoints'

/**
 * Admin-afgørelse af knockout-kampe.
 *
 * Bold giver os ikke FT/AET/Pen-koden, og slutresultatet inkluderer forlænget
 * spilletid — så en knockout-kamp kan IKKE auto-afgøres. Admin bekræfter her
 * hvordan kampen blev afgjort, hvilket gater scoringen (bets er pending indtil).
 */

type KoMatch = {
  id: number
  round_id: number | null
  kickoff: string | null
  status: string
  home_score: number | null
  away_score: number | null
  is_on_fire: boolean | null
  ko_method: string | null
  ko_advanced: string | null
  ko_resolved: boolean | null
  home_team: { name: string } | null
  away_team: { name: string } | null
  round: { name: string } | null
}

/** GET — alle knockout-kampe + deres afgørelses-status (til admin-fanen). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data, error } = await supabaseAdmin
    .from('matches')
    .select(`
      id, round_id, kickoff, status, home_score, away_score,
      is_on_fire, ko_method, ko_advanced, ko_resolved,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name),
      round:rounds!round_id(name)
    `)
    .eq('is_knockout', true)
    .order('kickoff', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matches = ((data ?? []) as unknown as KoMatch[]).map((m) => ({
    id: m.id,
    round_id: m.round_id,
    kickoff: m.kickoff,
    status: m.status,
    home_team: m.home_team?.name ?? '?',
    away_team: m.away_team?.name ?? '?',
    home_score: m.home_score,
    away_score: m.away_score,
    is_on_fire: !!m.is_on_fire,
    ko_method: m.ko_method,
    ko_advanced: m.ko_advanced,
    ko_resolved: !!m.ko_resolved,
    round_name: m.round?.name ?? '',
  }))

  return NextResponse.json({ matches })
}

/**
 * POST — afgør en knockout-kamp.
 * Body: { match_id, method: 'reg'|'et'|'pen', advanced: '1'|'2' }
 *   method 'reg' = afgjort i ordinær tid (ko_method=null, ingen X)
 *   method 'et'  = forlænget spilletid
 *   method 'pen' = straffespark
 *   advanced     = hvem gik videre (1=hjemme, 2=ude)
 * Sætter ko_resolved=true og kører pointberegning for rundens kampe straks.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { match_id, method, advanced } = body as {
    match_id?: number
    method?: string
    advanced?: string
  }

  if (!match_id || !['reg', 'et', 'pen'].includes(method ?? '') || !['1', '2'].includes(advanced ?? '')) {
    return NextResponse.json({ error: 'match_id, method (reg/et/pen) og advanced (1/2) er påkrævet' }, { status: 400 })
  }

  const koMethod = method === 'reg' ? null : method

  const { data: match, error } = await supabaseAdmin
    .from('matches')
    .update({ ko_method: koMethod, ko_advanced: advanced, ko_resolved: true })
    .eq('id', match_id)
    .eq('is_knockout', true)
    .select('id, round_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Score rundens bets straks (knockout-bets var pending indtil nu).
  if (match?.round_id) {
    try {
      await calculateRoundPoints(match.round_id as number)
    } catch (e) {
      console.error('[admin/knockout] calculateRoundPoints fejl:', e)
    }
  }

  await logAudit(req, {
    action: 'match.resolve_knockout',
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    targetTable: 'matches',
    targetId: match_id,
    after: { ko_method: koMethod, ko_advanced: advanced, ko_resolved: true },
  })

  return NextResponse.json({ ok: true })
}
