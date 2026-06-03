import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { computeSubBlockRanges, GRAND_TOUR_MIN_STAGES } from '@/lib/cyclingBlocks'

export type PreviewBlock = {
  race_id: string | null
  race_name: string
  race_type: string
  is_grand_tour: boolean
  has_rest_days: boolean
  fallback_used: boolean
  stage_count: number
  sub_blocks: { label: string; range: [number, number]; stage_count: number }[]
}

export type PreviewBundle = {
  key: string
  label: string
  races: string[]
}

export type PreviewResponse = {
  bundles: PreviewBundle[]
  blocks: PreviewBlock[]
}

// Klassiker-pakker — samme grupper som generateCyclingBlocks bruger
const FLANDERN_SLUGS = [
  'omloop-het-nieuwsblad', 'strade-bianche', 'milano-sanremo',
  'e3-harelbeke', 'gent-wevelgem', 'dwars-door-vlaanderen',
  'ronde-van-vlaanderen',
]
const ARDENNERNE_SLUGS = [
  'paris-roubaix', 'amstel-gold-race', 'la-fleche-wallonne',
  'liege-bastogne-liege',
]

/**
 * POST /api/cycling/preview-blocks
 * Body: { race_ids: string[] }
 *
 * Returnerer en forhåndsvisning af hvilke blokke der vil blive lavet hvis
 * disse løb tilføjes til et nyt spil — så admin kan se strukturen INDEN
 * de klikker "Opret". Bruger nøjagtigt samme logik som generateCyclingBlocks
 * (delt via computeSubBlockRanges).
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const body = await req.json().catch(() => null) as { race_ids?: unknown } | null
  const raceIds = Array.isArray(body?.race_ids)
    ? (body!.race_ids as unknown[]).filter((v): v is string => typeof v === 'string')
    : []
  if (raceIds.length === 0) {
    return NextResponse.json({ bundles: [], blocks: [] } satisfies PreviewResponse)
  }

  // Hent races inkl. rest_days
  const { data: races } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, pcs_slug, race_type, start_date, rest_days')
    .in('id', raceIds)
    .order('start_date', { ascending: true })

  if (!races?.length) {
    return NextResponse.json({ bundles: [], blocks: [] } satisfies PreviewResponse)
  }

  // Identificer klassiker-pakker
  const slugsSelected = new Set(races.map((r) => r.pcs_slug as string))
  const flandern = FLANDERN_SLUGS.filter((s) => slugsSelected.has(s))
  const ardennerne = ARDENNERNE_SLUGS.filter((s) => slugsSelected.has(s))
  const inBundle = new Set([...flandern, ...ardennerne])

  const bundles: PreviewBundle[] = []
  if (flandern.length > 0) {
    bundles.push({
      key: 'flandern',
      label: 'Flandern-klassikerne',
      races: flandern.map((slug) => races.find((r) => r.pcs_slug === slug)?.name ?? slug),
    })
  }
  if (ardennerne.length > 0) {
    bundles.push({
      key: 'ardennerne',
      label: 'Ardennerne-klassikerne',
      races: ardennerne.map((slug) => races.find((r) => r.pcs_slug === slug)?.name ?? slug),
    })
  }

  // Stage races får hver sin top-blok (+ sub-blokke ved hviledage)
  const stageRaces = races.filter((r) => r.race_type === 'stage_race')

  // Hent stages for alle stage races
  const stageRaceIds = stageRaces.map((r) => r.id as string)
  const stagesByRace = new Map<string, { stage_number: number; start_date: string }[]>()
  if (stageRaceIds.length > 0) {
    const { data: stages } = await supabaseAdmin
      .from('cycling_stages')
      .select('race_id, stage_number, start_date')
      .in('race_id', stageRaceIds)
      .order('stage_number')
    for (const s of stages ?? []) {
      const rid = s.race_id as string
      if (!stagesByRace.has(rid)) stagesByRace.set(rid, [])
      stagesByRace.get(rid)!.push({
        stage_number: s.stage_number as number,
        start_date: s.start_date as string,
      })
    }
  }

  const blocks: PreviewBlock[] = []

  // One-day løb der ikke er i en bundle → egen top-blok uden sub-blokke
  const oneDayRaces = races.filter((r) => r.race_type !== 'stage_race' && !inBundle.has(r.pcs_slug as string))
  for (const r of oneDayRaces) {
    blocks.push({
      race_id: r.id as string,
      race_name: r.name as string,
      race_type: r.race_type as string,
      is_grand_tour: false,
      has_rest_days: false,
      fallback_used: false,
      stage_count: 1,
      sub_blocks: [],
    })
  }

  // Stage races
  for (const r of stageRaces) {
    const stages = stagesByRace.get(r.id as string) ?? []
    const restDays = (r.rest_days as string[] | null) ?? null
    const hasRestDays = !!restDays && restDays.length > 0
    const isGT = stages.length >= GRAND_TOUR_MIN_STAGES // tre-uger eller mere

    let subRanges = computeSubBlockRanges(stages, restDays)
    let fallbackUsed = false
    // computeSubBlockRanges falder selv tilbage til "3 lige uger" hvis rest_days mangler.
    // Hvis blokken er et GT og rest_days mangler, markér det.
    if (isGT && !hasRestDays && subRanges.length > 1) fallbackUsed = true
    if (subRanges.length <= 1) subRanges = []

    blocks.push({
      race_id: r.id as string,
      race_name: r.name as string,
      race_type: r.race_type as string,
      is_grand_tour: isGT,
      has_rest_days: hasRestDays,
      fallback_used: fallbackUsed,
      stage_count: stages.length,
      sub_blocks: subRanges.map((sb) => ({
        label: sb.label,
        range: sb.range,
        stage_count: stages.filter((s) => s.stage_number >= sb.range[0] && s.stage_number <= sb.range[1]).length,
      })),
    })
  }

  return NextResponse.json({ bundles, blocks } satisfies PreviewResponse)
}
