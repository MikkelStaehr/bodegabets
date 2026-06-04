import { supabaseAdmin } from '@/lib/supabase'
import { computeSubBlockRanges } from '@/lib/cyclingBlocks'

// ── Slug-grupper ────────────────────────────────────────────────────────────

const FLANDERN_SLUGS = [
  'omloop-het-nieuwsblad',
  'strade-bianche',
  'milano-sanremo',
  'e3-harelbeke',
  'gent-wevelgem',
  'dwars-door-vlaanderen',
  'ronde-van-vlaanderen',
]

const ARDENNERNE_SLUGS = [
  'paris-roubaix',
  'amstel-gold-race',
  'la-fleche-wallonne',
  'liege-bastogne-liege',
]

// ── Types ───────────────────────────────────────────────────────────────────

type RaceRow = {
  id: string
  name: string
  pcs_slug: string
  race_type: string
  start_date: string
  rest_days: string[] | null
}

type StageRow = { stage_number: number; start_date: string }

// ── Helpers ─────────────────────────────────────────────────────────────────

function lockDeadline(startDates: string[]): string {
  const earliest = startDates
    .filter(Boolean)
    .sort()[0]

  if (!earliest) return new Date().toISOString()

  const deadline = new Date(earliest)
  deadline.setMinutes(deadline.getMinutes() - 30)

  if (deadline < new Date()) return new Date().toISOString()
  return deadline.toISOString()
}

// computeSubBlockRanges er flyttet til lib/cyclingBlocks.ts (pure function).

// ── Main ────────────────────────────────────────────────────────────────────

export async function generateCyclingBlocks(
  gameId: number,
  raceSelections: { race_id: string }[]
): Promise<void> {
  // Find race_ids der ALLEREDE har cycling_block_id (skal ikke have nye blokke)
  const { data: existingLinks } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id, cycling_block_id')
    .eq('game_id', gameId)

  const racesWithBlock = new Set(
    (existingLinks ?? [])
      .filter((l) => l.cycling_block_id != null)
      .map((l) => l.race_id as string)
  )

  // Find næste block_order baseret på eksisterende blokke
  const { data: existingBlocks } = await supabaseAdmin
    .from('cycling_blocks')
    .select('block_order')
    .eq('game_id', gameId)
    .order('block_order', { ascending: false })
    .limit(1)

  let blockOrder = ((existingBlocks?.[0]?.block_order as number | undefined) ?? 0) + 1

  // Hent alle valgte løb (filtrer dem der allerede har en blok fra)
  const raceIds = raceSelections
    .map((r) => r.race_id)
    .filter((id) => !racesWithBlock.has(id))

  if (raceIds.length === 0) return

  const { data: races } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, pcs_slug, race_type, start_date, rest_days')
    .in('id', raceIds)
    .order('start_date', { ascending: true })

  if (!races?.length) return

  const raceMap = new Map<string, RaceRow>()
  for (const r of races) raceMap.set(r.pcs_slug, r as RaceRow)

  // Gruppér løb (kun nye, ikke-blok-tildelte) — sortér stage races kronologisk
  const flandern = FLANDERN_SLUGS
    .map((s) => raceMap.get(s))
    .filter((r): r is RaceRow => !!r)

  const ardennerne = ARDENNERNE_SLUGS
    .map((s) => raceMap.get(s))
    .filter((r): r is RaceRow => !!r)

  const stageRaces = (races as RaceRow[])
    .filter((r) => r.race_type === 'stage_race')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  // ── Flandern-blok ─────────────────────────────────────────────────────

  if (flandern.length > 0) {
    const deadline = lockDeadline(flandern.map((r) => r.start_date))
    const startsAt = flandern.map((r) => r.start_date).filter(Boolean).sort()[0] ?? null
    const endsAt = flandern.map((r) => r.start_date).filter(Boolean).sort().reverse()[0] ?? null

    const { data: block } = await supabaseAdmin
      .from('cycling_blocks')
      .insert({
        game_id: gameId,
        name: 'Flandern-klassikerne',
        block_order: blockOrder,
        lock_deadline: deadline,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .select('id')
      .single()

    if (block) {
      const flandernIds = flandern.map((r) => r.id)
      await supabaseAdmin
        .from('cycling_game_races')
        .update({ cycling_block_id: block.id })
        .eq('game_id', gameId)
        .in('race_id', flandernIds)
    }

    blockOrder++
  }

  // ── Ardennerne-blok ───────────────────────────────────────────────────

  if (ardennerne.length > 0) {
    const deadline = lockDeadline(ardennerne.map((r) => r.start_date))
    const startsAt = ardennerne.map((r) => r.start_date).filter(Boolean).sort()[0] ?? null
    const endsAt = ardennerne.map((r) => r.start_date).filter(Boolean).sort().reverse()[0] ?? null

    const { data: block } = await supabaseAdmin
      .from('cycling_blocks')
      .insert({
        game_id: gameId,
        name: 'Ardennerne-klassikerne',
        block_order: blockOrder,
        lock_deadline: deadline,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .select('id')
      .single()

    if (block) {
      const ardennerneIds = ardennerne.map((r) => r.id)
      await supabaseAdmin
        .from('cycling_game_races')
        .update({ cycling_block_id: block.id })
        .eq('game_id', gameId)
        .in('race_id', ardennerneIds)
    }

    blockOrder++
  }

  // ── Stage races — parent + sub-blokke pr. hviledag ────────────────────

  for (const race of stageRaces) {
    // Hent etaper
    const { data: stages } = await supabaseAdmin
      .from('cycling_stages')
      .select('stage_number, start_date')
      .eq('race_id', race.id)
      .order('stage_number', { ascending: true })

    const stageRows: StageRow[] = (stages ?? []).map((s) => ({
      stage_number: s.stage_number as number,
      start_date: s.start_date as string,
    }))

    if (stageRows.length === 0) {
      // Ingen etaper — opret en simpel blok (fx endags-løb fejlagtigt markeret som stage_race)
      const deadline = lockDeadline([race.start_date])

      const { data: block } = await supabaseAdmin
        .from('cycling_blocks')
        .insert({
          game_id: gameId,
          name: race.name,
          block_order: blockOrder,
          lock_deadline: deadline,
          starts_at: race.start_date,
          ends_at: race.start_date,
        })
        .select('id')
        .single()

      if (block) {
        await supabaseAdmin
          .from('cycling_game_races')
          .update({ cycling_block_id: block.id })
          .eq('game_id', gameId)
          .eq('race_id', race.id)
      }

      blockOrder++
      continue
    }

    const sortedStages = [...stageRows].sort((a, b) => a.stage_number - b.stage_number)
    const minStage = sortedStages[0].stage_number
    const maxStage = sortedStages[sortedStages.length - 1].stage_number
    const raceStartsAt = sortedStages[0].start_date
    const raceEndsAt = sortedStages[sortedStages.length - 1].start_date

    // Beregn sub-blokke FØR vi opretter parent — så vi kender deadline for første uge
    const subRanges = computeSubBlockRanges(sortedStages, race.rest_days)
    const firstWeekStages = sortedStages.filter(
      (s) => subRanges.length > 0 && s.stage_number >= subRanges[0].range[0] && s.stage_number <= subRanges[0].range[1]
    )
    const parentDeadline = lockDeadline(
      firstWeekStages.length > 0 ? firstWeekStages.map((s) => s.start_date) : [race.start_date]
    )

    const { data: parentBlock } = await supabaseAdmin
      .from('cycling_blocks')
      .insert({
        game_id: gameId,
        name: race.name,
        block_order: blockOrder,
        lock_deadline: parentDeadline,
        stage_number_min: minStage,
        stage_number_max: maxStage,
        starts_at: raceStartsAt,
        ends_at: raceEndsAt,
      })
      .select('id')
      .single()

    if (!parentBlock) {
      blockOrder++
      continue
    }

    // Tilknyt løbet til parent-blokken
    await supabaseAdmin
      .from('cycling_game_races')
      .update({ cycling_block_id: parentBlock.id })
      .eq('game_id', gameId)
      .eq('race_id', race.id)

    blockOrder++

    // Opret sub-blokke (én pr. uge mellem hviledage, eller 3 lige uger som fallback)
    if (subRanges.length <= 1) continue

    for (const sub of subRanges) {
      const subStages = sortedStages.filter(
        (s) => s.stage_number >= sub.range[0] && s.stage_number <= sub.range[1]
      )
      if (subStages.length === 0) continue

      const subDeadline = lockDeadline(subStages.map((s) => s.start_date))
      const subStartsAt = subStages[0].start_date
      const subEndsAt = subStages[subStages.length - 1].start_date

      await supabaseAdmin
        .from('cycling_blocks')
        .insert({
          game_id: gameId,
          name: `${race.name} — ${sub.label} (Etape ${sub.range[0]}-${sub.range[1]})`,
          block_order: blockOrder,
          lock_deadline: subDeadline,
          parent_block_id: parentBlock.id,
          stage_number_min: sub.range[0],
          stage_number_max: sub.range[1],
          starts_at: subStartsAt,
          ends_at: subEndsAt,
        })

      blockOrder++
    }
  }

  // Resortér block_order kronologisk efter starts_at — så Dauphiné (juni)
  // havner mellem Giro (maj) og Tour (juli) selv om den blev tilføjet sidst.
  await renumberCyclingBlocksByDate(gameId)
}

/**
 * Renumberer block_order for alle blokke i et spil så top-blokke sorteres
 * efter starts_at (kronologisk) og sub-blokke følger deres parent og deres
 * eget stage_number_min. Idempotent.
 *
 * Eksporteret så add-races-flowet (og evt. en admin-knap) kan kalde den
 * efter manuel ompusning.
 */
export async function renumberCyclingBlocksByDate(gameId: number): Promise<void> {
  const { data: blocks } = await supabaseAdmin
    .from('cycling_blocks')
    .select('id, parent_block_id, starts_at, stage_number_min, block_order')
    .eq('game_id', gameId)

  if (!blocks?.length) return

  type B = {
    id: string
    parent_block_id: string | null
    starts_at: string | null
    stage_number_min: number | null
    block_order: number
  }
  const all = blocks as B[]
  const topBlocks = all.filter((b) => b.parent_block_id == null)
  const subsByParent = new Map<string, B[]>()
  for (const b of all) {
    if (!b.parent_block_id) continue
    if (!subsByParent.has(b.parent_block_id)) subsByParent.set(b.parent_block_id, [])
    subsByParent.get(b.parent_block_id)!.push(b)
  }

  // Top-blokke sorteres efter starts_at; fall-back til eksisterende block_order
  // hvis starts_at mangler (bagudkompatibilitet for blokke uden datofelter).
  topBlocks.sort((a, b) => {
    const aDate = a.starts_at ?? ''
    const bDate = b.starts_at ?? ''
    if (aDate && bDate) return aDate.localeCompare(bDate)
    if (aDate) return -1
    if (bDate) return 1
    return a.block_order - b.block_order
  })

  // Tildel nye block_order værdier — top-blok først, dens sub-blokke umiddelbart
  // efter (sorteret efter stage_number_min så uger forbliver i rækkefølge).
  let order = 1
  const updates: { id: string; block_order: number }[] = []
  for (const top of topBlocks) {
    if (top.block_order !== order) updates.push({ id: top.id, block_order: order })
    order++
    const subs = subsByParent.get(top.id) ?? []
    subs.sort((a, b) => (a.stage_number_min ?? 0) - (b.stage_number_min ?? 0))
    for (const sub of subs) {
      if (sub.block_order !== order) updates.push({ id: sub.id, block_order: order })
      order++
    }
  }

  // Skriv kun de blokke der reelt skifter — sparer round-trips.
  for (const u of updates) {
    await supabaseAdmin.from('cycling_blocks').update({ block_order: u.block_order }).eq('id', u.id)
  }
}
