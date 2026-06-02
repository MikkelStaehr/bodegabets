/**
 * rescore-cycling-stage.ts
 *
 * Kører calculateCyclingPoints igen for én eller flere etaper, så
 * gamle score-rækker får populeret de nye breakdown-kolonner
 * (cat_multiplier, profile_multiplier, train_multiplier).
 *
 * Total point ændres IKKE — det er en generated column i DB der altid
 * beregnes på baggrund af base + multiplier + bonus + jersey + team.
 *
 * Brug:
 *   npm run rescore-cycling-stage -- --race giro-d-italia --stage 21
 *   npm run rescore-cycling-stage -- --race giro-d-italia --all-uploaded
 */

import { supabaseAdmin } from '../lib/supabase'
import { runCyclingPointsForStage } from '../lib/calculateCyclingPoints'

const args = process.argv.slice(2)
function arg(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] ?? null : null
}
const raceSlug = arg('race')
const stageArg = arg('stage')
const allUploaded = args.includes('--all-uploaded')

if (!raceSlug || (!stageArg && !allUploaded)) {
  console.error('brug: npm run rescore-cycling-stage -- --race <slug> --stage <N>')
  console.error('  eller: npm run rescore-cycling-stage -- --race <slug> --all-uploaded')
  process.exit(1)
}

async function main() {
  const { data: race } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name')
    .eq('pcs_slug', raceSlug!)
    .single()
  if (!race) throw new Error(`race not found: ${raceSlug}`)
  console.log(`race: ${race.name}`)

  let stageQuery = supabaseAdmin
    .from('cycling_stages')
    .select('id, stage_number')
    .eq('race_id', race.id)
  if (stageArg) {
    stageQuery = stageQuery.eq('stage_number', Number(stageArg))
  } else if (allUploaded) {
    stageQuery = stageQuery.not('results_uploaded_at', 'is', null)
  }
  const { data: stages } = await stageQuery.order('stage_number')
  if (!stages?.length) { console.log('no stages'); return }

  for (const s of stages) {
    console.log(`E${s.stage_number}: re-scoring …`)
    await runCyclingPointsForStage(s.id as string)
  }
  console.log(`færdig: ${stages.length} etaper re-scored`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
