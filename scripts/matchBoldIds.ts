/**
 * matchBoldIds.ts
 * CLI-script: matcher eksisterende kampe med Bold.dk IDs.
 * Kør: npm run match-bold-ids
 *
 * Forudsætning: Kør scripts/add-bold-match-id.sql og add-bold-match-logs.sql i Supabase.
 */

import { runMatchBoldIds, logMatchBoldRun } from '../lib/matchBoldIds'

async function main() {
  const total = 30
  process.stdout.write(`Starter match-bold-ids (${total} dage)…\n`)

  const result = await runMatchBoldIds()

  for (const d of result.details) {
    const suffix = d.match_ids.length > 1 ? ` (${d.match_ids.length} spil)` : ''
    console.log(`Matched: ${d.home_team} vs ${d.away_team} → bold_id: ${d.bold_id}${suffix}`)
  }

  if (result.errors.length) {
    console.error('Fejl:', result.errors.join('\n'))
  }

  await logMatchBoldRun(
    result,
    result.errors.length ? 'error' : 'ok',
    result.errors.length ? result.errors.join('; ') : undefined
  )

  console.log(`\nFærdig. ${result.matched} kampe matchet med Bold IDs.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
