/**
 * Auto-realign af cykel-sub-blokke til hviledage.
 *
 * Bug det løser: blok-generatoren kørte nogle gange FØR `rest_days` var skrabet
 * fra PCS → fald-tilbage til lige 7/7/7-split i stedet for hviledags-split. Når
 * hviledagene senere ankom, sad blokkene fast med forkerte grænser (TdF 2026:
 * 1-7/8-14/15-21 i stedet for 1-9/10-15/16-21).
 *
 * Denne rutine kører dagligt og snapper sub-blokkenes stage-ranges til
 * hviledagene så snart de er tilgængelige. IN-PLACE (bevarer blok-id'er) og
 * idempotent (rører kun blokke der ikke allerede matcher). Springer over hvis
 * en uge allerede er FINISHED — vi disrupterer aldrig et løb midt i scoringen
 * (den slags rettes manuelt). Trup er pr. løb, ikke pr. uge, så re-align rører
 * hverken trup, lineups eller scoring — kun hvilken uge en etape hører til.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { computeSubBlockRanges } from '@/lib/cyclingBlocks'

export async function realignBlocksToRestDays(): Promise<{ realigned: number; details: string[] }> {
  const details: string[] = []
  let realigned = 0

  const { data: races } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, rest_days, status')
    .eq('race_type', 'stage_race')
    .neq('status', 'finished')

  for (const race of races ?? []) {
    const restDays = (race.rest_days as string[] | null) ?? []
    if (restDays.length === 0) continue // ingen hviledage endnu → intet at aligne efter

    const { data: stages } = await supabaseAdmin
      .from('cycling_stages')
      .select('stage_number, start_date, results_uploaded_at')
      .eq('race_id', race.id)
      .order('stage_number', { ascending: true })
    if (!stages?.length) continue

    const stageRows = stages.map((s) => ({
      stage_number: s.stage_number as number,
      start_date: s.start_date as string,
      results_uploaded_at: (s as { results_uploaded_at: string | null }).results_uploaded_at,
    }))
    const expected = computeSubBlockRanges(
      stageRows.map((s) => ({ stage_number: s.stage_number, start_date: s.start_date })),
      restDays,
    )
    if (expected.length < 2) continue // deles ikke (for lille løb / ingen brugbare cutoffs)

    // Find top-blok(ke) for løbet + deres sub-blokke.
    const { data: parents } = await supabaseAdmin
      .from('cycling_blocks')
      .select('id, name')
      .eq('name', race.name)
      .is('parent_block_id', null)

    for (const parent of parents ?? []) {
      const { data: subs } = await supabaseAdmin
        .from('cycling_blocks')
        .select('id, status, stage_number_min, stage_number_max, finalized_at')
        .eq('parent_block_id', parent.id)
        .order('block_order', { ascending: true })
      if (!subs || subs.length !== expected.length) continue // struktur-mismatch → skip (sikkert)

      const aligned = subs.every(
        (sb, i) => sb.stage_number_min === expected[i].range[0] && sb.stage_number_max === expected[i].range[1],
      )
      if (aligned) continue // matcher allerede

      // Aldrig disrupter et løb hvor en uge allerede er finished/finaliseret.
      if (subs.some((sb) => sb.status === 'finished' || sb.finalized_at != null)) {
        details.push(`${race.name}: sub-blok allerede finished — springer over (kræver manuel re-align)`)
        continue
      }

      for (let i = 0; i < subs.length; i++) {
        const [min, max] = expected[i].range
        const inRange = stageRows.filter((s) => s.stage_number >= min && s.stage_number <= max)
        const startsAt = inRange[0]?.start_date ?? null
        const endsAt = inRange[inRange.length - 1]?.start_date ?? null
        const uploaded = inRange.filter((s) => s.results_uploaded_at != null).length
        const status = uploaded === 0 ? 'upcoming' : uploaded === inRange.length ? 'finished' : 'active'
        await supabaseAdmin
          .from('cycling_blocks')
          .update({
            stage_number_min: min,
            stage_number_max: max,
            starts_at: startsAt,
            ends_at: endsAt,
            name: `${race.name} — ${expected[i].label} (Etape ${min}-${max})`,
            status,
          })
          .eq('id', subs[i].id)
      }
      realigned++
      details.push(`${race.name}: re-alignet til ${expected.map((e) => e.range.join('-')).join(', ')}`)
    }
  }

  return { realigned, details }
}
