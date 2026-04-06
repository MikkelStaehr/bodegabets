import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params

  // Verify user is member of this game
  const { data: membership } = await supabase
    .from('game_members')
    .select('user_id')
    .eq('game_id', Number(gameId))
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  // Get races linked to this game
  const { data: gameRaces } = await supabase
    .from('cycling_game_races')
    .select('race_id, block_number')
    .eq('game_id', Number(gameId))

  if (!gameRaces?.length) return NextResponse.json({ events: [] })

  const raceIds = gameRaces.map((gr) => gr.race_id)

  // Fetch race details
  const { data: races } = await supabase
    .from('cycling_races')
    .select('id, name, pcs_slug, race_type, profile, start_date, status')
    .in('id', raceIds)

  if (!races?.length) return NextResponse.json({ events: [] })

  // Fetch stages for all stage races
  const stageRaceIds = races.filter((r) => r.race_type === 'stage_race').map((r) => r.id)
  const { data: stages } = stageRaceIds.length > 0
    ? await supabase
        .from('cycling_stages')
        .select('id, race_id, stage_number, name, profile, start_date')
        .in('race_id', stageRaceIds)
        .order('stage_number', { ascending: true })
    : { data: [] as { id: string; race_id: string; stage_number: number; name: string; profile: string; start_date: string }[] }

  const raceById = new Map(races.map((r) => [r.id, r]))
  const blockByRace = new Map(gameRaces.map((gr) => [gr.race_id, gr.block_number]))

  type ScheduleEvent = {
    date: string
    race_name: string
    race_slug: string
    race_type: string
    stage_number: number | null
    stage_name: string | null
    profile: string
    status: string
    block_number: number
  }

  const events: ScheduleEvent[] = []

  // One-day races → single event
  for (const race of races) {
    if (race.race_type === 'one_day') {
      events.push({
        date: race.start_date,
        race_name: race.name,
        race_slug: race.pcs_slug,
        race_type: race.race_type,
        stage_number: null,
        stage_name: null,
        profile: race.profile,
        status: race.status,
        block_number: blockByRace.get(race.id) ?? 0,
      })
    }
  }

  // Stage races → one event per stage
  for (const stage of stages ?? []) {
    const race = raceById.get(stage.race_id)
    if (!race) continue
    events.push({
      date: stage.start_date,
      race_name: race.name,
      race_slug: race.pcs_slug,
      race_type: race.race_type,
      stage_number: stage.stage_number,
      stage_name: stage.name,
      profile: stage.profile || race.profile,
      status: race.status,
      block_number: blockByRace.get(race.id) ?? 0,
    })
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ events })
}
