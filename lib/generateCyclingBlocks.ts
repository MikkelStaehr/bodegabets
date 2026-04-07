import { supabaseAdmin } from '@/lib/supabase'

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
}

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

// ── Main ────────────────────────────────────────────────────────────────────

export async function generateCyclingBlocks(
  gameId: number,
  raceSelections: { race_id: string }[]
): Promise<void> {
  // Idempotent: tjek om blokke allerede eksisterer for dette game
  const { count } = await supabaseAdmin
    .from('cycling_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)

  if (count && count > 0) return

  // Hent alle valgte løb
  const raceIds = raceSelections.map((r) => r.race_id)
  const { data: races } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, pcs_slug, race_type, start_date')
    .in('id', raceIds)

  if (!races?.length) return

  const raceMap = new Map<string, RaceRow>()
  for (const r of races) raceMap.set(r.pcs_slug, r)

  // Gruppér løb
  const flandern = FLANDERN_SLUGS
    .map((s) => raceMap.get(s))
    .filter((r): r is RaceRow => !!r)

  const ardennerne = ARDENNERNE_SLUGS
    .map((s) => raceMap.get(s))
    .filter((r): r is RaceRow => !!r)

  const stageRaces = races.filter((r) => r.race_type === 'stage_race')

  let blockOrder = 1

  // ── Flandern-blok ─────────────────────────────────────────────────────

  if (flandern.length > 0) {
    const deadline = lockDeadline(flandern.map((r) => r.start_date))

    const { data: block } = await supabaseAdmin
      .from('cycling_blocks')
      .insert({
        game_id: gameId,
        name: 'Flandern-klassikerne',
        block_order: blockOrder,
        lock_deadline: deadline,
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

    const { data: block } = await supabaseAdmin
      .from('cycling_blocks')
      .insert({
        game_id: gameId,
        name: 'Ardennerne-klassikerne',
        block_order: blockOrder,
        lock_deadline: deadline,
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

  // ── Stage races — parent + 3 sub-blokke ───────────────────────────────

  for (const race of stageRaces) {
    // Hent etaper
    const { data: stages } = await supabaseAdmin
      .from('cycling_stages')
      .select('stage_number, start_date')
      .eq('race_id', race.id)
      .order('stage_number', { ascending: true })

    if (!stages?.length) {
      // Ingen etaper — opret en simpel blok
      const deadline = lockDeadline([race.start_date])

      const { data: block } = await supabaseAdmin
        .from('cycling_blocks')
        .insert({
          game_id: gameId,
          name: race.name,
          block_order: blockOrder,
          lock_deadline: deadline,
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

    // Opret parent-blok
    const uge1Stages = stages.filter((s) => s.stage_number >= 1 && s.stage_number <= 7)
    const parentDeadline = lockDeadline(uge1Stages.map((s) => s.start_date))

    const { data: parentBlock } = await supabaseAdmin
      .from('cycling_blocks')
      .insert({
        game_id: gameId,
        name: race.name,
        block_order: blockOrder,
        lock_deadline: parentDeadline,
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

    // Opret 3 sub-blokke
    const subBlocks = [
      { label: 'Uge 1', range: [1, 7] as const },
      { label: 'Uge 2', range: [8, 14] as const },
      { label: 'Uge 3', range: [15, 21] as const },
    ]

    for (const sub of subBlocks) {
      const subStages = stages.filter(
        (s) => s.stage_number >= sub.range[0] && s.stage_number <= sub.range[1]
      )

      if (subStages.length === 0) continue

      const subDeadline = lockDeadline(subStages.map((s) => s.start_date))

      await supabaseAdmin
        .from('cycling_blocks')
        .insert({
          game_id: gameId,
          name: `${race.name} — ${sub.label} (Etape ${sub.range[0]}-${sub.range[1]})`,
          block_order: blockOrder,
          lock_deadline: subDeadline,
          parent_block_id: parentBlock.id,
        })

      blockOrder++
    }
  }
}
