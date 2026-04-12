import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import SquadBuilder from '@/components/cycling/SquadBuilder'
import type { Rider, RaceStartlist } from '@/components/cycling/SquadBuilder'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ block?: string }>
}

export default async function SquadPage({ params, searchParams }: Props) {
  const { id } = await params
  const { block: blockId } = await searchParams
  const gameId = Number(id)

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch game
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name, sport')
    .eq('id', gameId)
    .single()

  if (!game) notFound()
  if (game.sport !== 'cycling') redirect(`/games/${gameId}`)

  // Verify membership
  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect(`/games/${gameId}`)

  // Fetch ALL riders
  const { data: allRidersRaw } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, first_name, last_name, team_name, category, team_logo_url, photo_url')
    .order('category', { ascending: true })
    .order('last_name', { ascending: true })

  const allRiders: Rider[] = (allRidersRaw ?? []).map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    team_name: r.team_name,
    category: r.category,
    team_logo_url: r.team_logo_url,
    photo_url: r.photo_url,
  }))

  // Find startlists for ALL upcoming/active races in this game
  const raceStartlists: RaceStartlist[] = []

  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id')
    .eq('game_id', gameId)

  const raceIds = (gameRaces ?? []).map((gr) => gr.race_id)

  if (raceIds.length > 0) {
    const { data: races } = await supabaseAdmin
      .from('cycling_races')
      .select('id, name, status, start_date')
      .in('id', raceIds)
      .in('status', ['active', 'upcoming', 'finished'])
      .order('start_date', { ascending: true })

    if (races?.length) {
      // Fetch all startlists for these races in one query
      const activeRaceIds = races.map((r) => r.id)
      const { data: allStartlists } = await supabaseAdmin
        .from('cycling_startlists')
        .select('race_id, rider_id')
        .in('race_id', activeRaceIds)

      // Group by race
      const ridersByRace = new Map<string, string[]>()
      for (const row of allStartlists ?? []) {
        const arr = ridersByRace.get(row.race_id) ?? []
        arr.push(row.rider_id)
        ridersByRace.set(row.race_id, arr)
      }

      for (const race of races) {
        const riderIds = ridersByRace.get(race.id) ?? []
        if (riderIds.length > 0) {
          raceStartlists.push({
            raceId: race.id,
            raceName: race.name,
            riderIds,
          })
        }
      }
    }
  }

  // Fetch block name and block race IDs if blockId is provided
  let blockName: string | null = null
  let blockRaceIds: string[] = []
  if (blockId) {
    const { data: blockData } = await supabaseAdmin
      .from('cycling_blocks')
      .select('name')
      .eq('id', blockId)
      .single()
    blockName = blockData?.name ?? null

    const { data: blockRaces } = await supabaseAdmin
      .from('cycling_game_races')
      .select('race_id')
      .eq('game_id', gameId)
      .eq('cycling_block_id', blockId)

    blockRaceIds = (blockRaces ?? []).map((r) => r.race_id)
  }

  // Fetch existing squad (per block if blockId is provided)
  let initialSquad: Rider[] = []

  const existingSquadQuery = supabaseAdmin
    .from('cycling_squads')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)

  if (blockId) {
    existingSquadQuery.eq('cycling_block_id', blockId)
  }

  const { data: existingSquad } = await existingSquadQuery.maybeSingle()

  if (existingSquad) {
    // Brug category_slot fra squad (snapshot ved udtagelse), ikke live cycling_riders.category
    const { data: squadRiders } = await supabaseAdmin
      .from('cycling_squad_riders')
      .select(`
        category_slot,
        rider:cycling_riders!inner(
          id, first_name, last_name, team_name, team_logo_url, photo_url
        )
      `)
      .eq('squad_id', existingSquad.id)

    initialSquad = (squadRiders ?? []).map((row) => {
      const r = row.rider as unknown as Omit<Rider, 'category'>
      return {
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        team_name: r.team_name,
        category: ((row as { category_slot?: number }).category_slot ?? 5),
        team_logo_url: r.team_logo_url,
        photo_url: r.photo_url,
      }
    })
  }

  return (
    <div className="min-h-screen" style={{ background: '#F2EDE4' }}>
      {/* Header */}
      <div style={{ background: '#1E3A5F', color: '#F2EDE4', padding: '20px 16px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(242,237,228,0.5)',
              marginBottom: 4,
            }}
          >
            {game.name}
          </p>
          <h1
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#F2EDE4',
              margin: 0,
            }}
          >
            {blockName ? `Brutto trup — ${blockName}` : 'Brutto trup'}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>
        <SquadBuilder
          gameId={gameId}
          availableRiders={allRiders}
          raceStartlists={raceStartlists}
          initialSquad={initialSquad}
          blockId={blockId ?? null}
          blockRaceIds={blockRaceIds}
        />
      </div>
    </div>
  )
}
