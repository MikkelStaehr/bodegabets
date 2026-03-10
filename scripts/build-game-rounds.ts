/**
 * build-game-rounds.ts
 * CLI-script: Kører buildLeagueRounds for en liga.
 * Kør: npm run build-game-rounds -- 1
 * Eller: npx dotenv -e .env.local -- npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/build-game-rounds.ts 1
 */

import { buildLeagueRounds } from '../lib/syncLeagueMatches'

async function main() {
  const leagueId = parseInt(process.argv[2] ?? '1', 10)

  if (!leagueId) {
    console.error('Brug: npx ts-node scripts/build-game-rounds.ts <league_id>')
    process.exit(1)
  }

  console.log(`Kører buildLeagueRounds(league_id=${leagueId})…`)

  const result = await buildLeagueRounds(leagueId)

  console.log('\nResultat:')
  console.log(`  Runder oprettet: ${result.rounds_created}`)
  console.log(`  Kampe oprettet:  ${result.matches_created}`)
  console.log(`  Kampe opdateret: ${result.matches_updated}`)
  if (result.debug) {
    console.log('  Debug:', JSON.stringify(result.debug, null, 2))
  }

  console.log('\nFærdig.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
