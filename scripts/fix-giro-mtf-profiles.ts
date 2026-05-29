/**
 * fix-giro-mtf-profiles.ts
 *
 * Engangs-fix: PCS-profilen p4 blev tidligere mappet til 'cobbled', men er
 * reelt 'mountain' (MTF — mountain top finish). I Giro 2026 ramte det flere
 * bjerg-etaper. Vi opdaterer KUN etaper der endnu ikke er kørt (ingen scoring
 * impact), for at give brugerne korrekt visning af profilen i kalenderen.
 *
 * Allerede kørte etaper (E2, E4, E7, E9, E14, E16) efterlades urørt for at
 * undgå at ændre historiske point — kan tages op separat hvis vi vil re-score.
 *
 * Kør: npm run fix-giro-mtf-profiles -- --dry-run
 *      npm run fix-giro-mtf-profiles
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const { data: race } = await supabase
    .from('cycling_races')
    .select('id, name')
    .eq('pcs_slug', 'giro-d-italia')
    .single()
  if (!race) throw new Error('giro-d-italia not found')

  const { data: stages } = await supabase
    .from('cycling_stages')
    .select('id, stage_number, profile, results_uploaded_at, vertical_meters, departure, arrival')
    .eq('race_id', race.id)
    .eq('profile', 'cobbled')
    .order('stage_number')

  const candidates = (stages ?? []).filter((s) => s.results_uploaded_at == null)

  console.log(`[fix] dry-run=${dryRun}`)
  console.log(`[fix] fandt ${stages?.length ?? 0} cobbled-etaper, hvoraf ${candidates.length} ikke er kørt:`)
  for (const s of candidates) {
    console.log(`  E${s.stage_number}: ${s.departure} → ${s.arrival} (vm=${s.vertical_meters})  cobbled → mountain`)
  }
  for (const s of (stages ?? []).filter((s) => s.results_uploaded_at != null)) {
    console.log(`  E${s.stage_number}: ALLEREDE KØRT — efterlades som cobbled (kan re-scores manuelt senere hvis ønsket)`)
  }

  if (candidates.length === 0) {
    console.log('[fix] intet at opdatere')
    return
  }

  if (dryRun) {
    console.log(`[fix] [dry] ville opdatere ${candidates.length} etaper`)
    return
  }

  const ids = candidates.map((s) => s.id)
  const { error } = await supabase
    .from('cycling_stages')
    .update({ profile: 'mountain' })
    .in('id', ids)
  if (error) throw error
  console.log(`[fix] opdaterede ${candidates.length} etaper til mountain`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
