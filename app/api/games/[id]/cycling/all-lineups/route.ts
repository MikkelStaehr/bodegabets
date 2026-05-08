import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { isStageDeadlinePassed } from '@/lib/cyclingDeadline'

type Props = { params: Promise<{ id: string }> }

/**
 * GET /api/games/[id]/cycling/all-lineups?stage_id=X
 *
 * Returner alle spilleres lineups for en specifik stage.
 * Kun tilgængeligt når lineup er låst (efter deadline).
 */
export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const numericGameId = Number(gameId)
  const stageId = req.nextUrl.searchParams.get('stage_id')

  if (!stageId) return NextResponse.json({ error: 'stage_id mangler' }, { status: 400 })

  // Membership check
  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', numericGameId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  // Tjek at deadline er passeret (eller lineup er låst for mindst én spiller)
  const { data: stage } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, start_date')
    .eq('id', stageId)
    .single()

  if (!stage?.start_date) return NextResponse.json({ error: 'Stage ikke fundet' }, { status: 404 })

  if (!isStageDeadlinePassed(stage.start_date)) {
    return NextResponse.json({ error: 'Deadline er ikke passeret endnu', locked: false }, { status: 403 })
  }

  // Hent alle squads for dette spil
  const { data: squads } = await supabaseAdmin
    .from('cycling_squads')
    .select('id, user_id')
    .eq('game_id', numericGameId)

  if (!squads?.length) return NextResponse.json({ lineups: [] })

  const squadIds = squads.map((s) => s.id)
  const userIds = [...new Set(squads.map((s) => s.user_id as string))]

  // Hent profiles separat
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds)

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, { username: p.username as string, avatar_url: p.avatar_url as string | null }])
  )

  // Hent lineups for denne stage
  const { data: lineups } = await supabaseAdmin
    .from('cycling_lineups')
    .select('id, squad_id')
    .eq('stage_id', stageId)
    .in('squad_id', squadIds)

  if (!lineups?.length) return NextResponse.json({ lineups: [] })

  const lineupIds = lineups.map((l) => l.id)

  // Hent lineup riders
  const { data: lineupRiders } = await supabaseAdmin
    .from('cycling_lineup_riders')
    .select('lineup_id, rider_id, role, slot_index, rider:cycling_riders!inner(id, first_name, last_name, team_name, category, team_logo_url, photo_url)')
    .in('lineup_id', lineupIds)

  // Hent scores hvis de findes
  const { data: scores } = await supabaseAdmin
    .from('cycling_scores')
    .select('lineup_id, rider_id, total_points')
    .in('lineup_id', lineupIds)

  const scoresByLineupRider = new Map<string, number>()
  for (const s of scores ?? []) {
    scoresByLineupRider.set(`${s.lineup_id}:${s.rider_id}`, Number(s.total_points) || 0)
  }

  // Byg output per spiller
  const ridersByLineup = new Map<string, typeof lineupRiders>()
  for (const lr of lineupRiders ?? []) {
    const key = String(lr.lineup_id)
    if (!ridersByLineup.has(key)) ridersByLineup.set(key, [])
    ridersByLineup.get(key)!.push(lr)
  }

  const result = lineups.map((lineup) => {
    const squad = squads.find((s) => s.id === lineup.squad_id)
    const profile = squad ? profileById.get(squad.user_id as string) ?? null : null

    const riders = (ridersByLineup.get(String(lineup.id)) ?? []).map((lr) => {
      const r = lr.rider as unknown as {
        id: string; first_name: string; last_name: string
        team_name: string; category: number
        team_logo_url: string | null; photo_url: string | null
      }
      return {
        rider_id: r.id,
        role: lr.role,
        slot_index: lr.slot_index,
        first_name: r.first_name,
        last_name: r.last_name,
        team_name: r.team_name,
        category: r.category,
        team_logo_url: r.team_logo_url,
        photo_url: r.photo_url,
        points: scoresByLineupRider.get(`${lineup.id}:${r.id}`) ?? null,
      }
    })

    const totalPoints = riders.reduce((sum, r) => sum + (r.points ?? 0), 0)

    return {
      user_id: squad?.user_id,
      username: profile?.username ?? 'Anonym',
      avatar_url: profile?.avatar_url ?? null,
      total_points: Math.round(totalPoints * 10) / 10,
      riders,
    }
  })

  // Sort by total points desc
  result.sort((a, b) => b.total_points - a.total_points)

  return NextResponse.json({ lineups: result })
}
