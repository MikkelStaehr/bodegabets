import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import SquadBuilder from '@/components/cycling/SquadBuilder'
import type { Rider, RaceStartlist } from '@/components/cycling/SquadBuilder'
import { computeBlockSquadLimits } from '@/lib/cyclingSquadLimits'
import { getEffectiveSquadRiders } from '@/lib/cyclingTransfers'

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
            startDate: (race.start_date as string | null) ?? null,
          })
        }
      }
    }
  }

  // Bloknavn + bloks løb — hentes FØR rytter-scoping, så puljen og 'UD'-markering
  // kan begrænses til netop denne bloks løb.
  let blockName: string | null = null
  let blockRaceIds: string[] = []
  let locked = false
  if (blockId) {
    const { data: blockData } = await supabaseAdmin
      .from('cycling_blocks')
      .select('name, lock_deadline, parent_block_id')
      .eq('id', blockId)
      .single()
    blockName = blockData?.name ?? null

    // Lås: når blokkens (eller parent-blokkens) lock_deadline = løbsstart er
    // passeret, kan brutto-truppen ikke længere ændres — kun transfers.
    let lockDeadline = blockData?.lock_deadline as string | null | undefined
    if (blockData?.parent_block_id) {
      const { data: parentBlk } = await supabaseAdmin
        .from('cycling_blocks')
        .select('lock_deadline')
        .eq('id', blockData.parent_block_id as string)
        .single()
      lockDeadline = (parentBlk?.lock_deadline as string | null | undefined) ?? lockDeadline
    }
    locked = !!lockDeadline && new Date() > new Date(lockDeadline)

    const { data: blockRaces } = await supabaseAdmin
      .from('cycling_game_races')
      .select('race_id')
      .eq('game_id', gameId)
      .eq('cycling_block_id', blockId)

    blockRaceIds = (blockRaces ?? []).map((r) => r.race_id)
  }

  // 'UD'-markering: KUN ryttere der er DNF i DENNE bloks løb — ikke tidligere løb.
  // (Falder tilbage til alle spillets løb hvis siden åbnes uden blok.)
  const abandonedScopeRaceIds = blockRaceIds.length > 0 ? blockRaceIds : raceIds
  const abandonedRiderIds: Set<string> = new Set()
  if (abandonedScopeRaceIds.length > 0) {
    const { data: dnfData } = await supabaseAdmin
      .from('cycling_results')
      .select('rider_id')
      .in('race_id', abandonedScopeRaceIds)
      .eq('dnf', true)
    for (const row of dnfData ?? []) {
      abandonedRiderIds.add(row.rider_id)
    }
  }

  // Begræns rytter-puljen til dem der faktisk er på startlisten for denne bloks
  // løb — så man ikke skal lede blandt ALLE ryttere. Falder tilbage til alle
  // ryttere hvis startlisten endnu ikke er offentliggjort (UI'et advarer da).
  const blockStartlistRiderIds = new Set(
    raceStartlists.filter((rs) => blockRaceIds.includes(rs.raceId)).flatMap((rs) => rs.riderIds)
  )
  const availableRiders: Rider[] = blockStartlistRiderIds.size > 0
    ? allRiders.filter((r) => blockStartlistRiderIds.has(r.id))
    : allRiders

  // Compute dynamic squad limits baseret på blokkens startlister
  const squadLimits = await computeBlockSquadLimits(blockRaceIds)

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
    // EFFEKTIV trup (efter anvendte transfers) — ellers ville en udbyttet rytter
    // (fx transferet ud) stadig blive vist i truppen. Kræver en race_id for at
    // slå transfers op; uden blok-løb falder vi tilbage til base-truppen.
    const effRaceId = blockRaceIds[0]
    let effRiders: { rider_id: string; category_slot: number }[]
    if (effRaceId) {
      effRiders = await getEffectiveSquadRiders(existingSquad.id, effRaceId, '9999-12-31')
    } else {
      const { data: baseRows } = await supabaseAdmin
        .from('cycling_squad_riders')
        .select('rider_id, category_slot')
        .eq('squad_id', existingSquad.id)
      effRiders = (baseRows ?? []).map((r) => ({
        rider_id: r.rider_id as string,
        category_slot: (r.category_slot as number) ?? 5,
      }))
    }

    const catByRider = new Map(effRiders.map((r) => [r.rider_id, r.category_slot]))
    const { data: riderDetails } = await supabaseAdmin
      .from('cycling_riders')
      .select('id, first_name, last_name, team_name, team_logo_url, photo_url')
      .in('id', effRiders.map((r) => r.rider_id))

    initialSquad = (riderDetails ?? []).map((r) => ({
      id: r.id as string,
      first_name: r.first_name as string,
      last_name: r.last_name as string,
      team_name: r.team_name as string,
      category: catByRider.get(r.id as string) ?? 5,
      team_logo_url: r.team_logo_url as string | null,
      photo_url: r.photo_url as string | null,
    }))
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
          availableRiders={availableRiders}
          raceStartlists={raceStartlists}
          initialSquad={initialSquad}
          blockId={blockId ?? null}
          blockRaceIds={blockRaceIds}
          squadLimits={squadLimits}
          abandonedRiderIds={[...abandonedRiderIds]}
          locked={locked}
        />
      </div>
    </div>
  )
}
