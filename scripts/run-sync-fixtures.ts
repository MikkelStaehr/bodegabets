/**
 * Kør sync-fixtures (runLeagueSync) for at teste Bold API paginering.
 * Kør: npx dotenv -e .env.local -- npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/run-sync-fixtures.ts
 */

import { runLeagueSync } from '../lib/syncLeagueMatches'

async function main() {
  console.log('Kører runLeagueSync()…\n')
  const results = await runLeagueSync()
  console.log('\nResultat:', JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
