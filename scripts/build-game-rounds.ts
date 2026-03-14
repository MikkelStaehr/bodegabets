/**
 * build-game-rounds.ts
 * CLI-script: Synkroniserer fixtures for en sæson.
 * Kør: npx ts-node scripts/build-game-rounds.ts <season_id>
 */

import { syncSeasonFixtures } from '../lib/syncLeagueMatches'

async function main() {
  const seasonId = parseInt(process.argv[2] ?? '1', 10)

  if (!seasonId) {
    console.error('Brug: npx ts-node scripts/build-game-rounds.ts <season_id>')
    process.exit(1)
  }

  console.log(`Kører syncSeasonFixtures(season_id=${seasonId})…`)

  const result = await syncSeasonFixtures(seasonId)

  console.log('\nResultat:')
  console.log(`  Kampe synkroniseret: ${result.synced}`)
  console.log(`  Runder upserted:     ${result.rounds_upserted}`)
  console.log(`  Kampe oprettet:      ${result.matches_created}`)
  console.log(`  Kampe opdateret:     ${result.matches_updated}`)
  if (result.errors.length) {
    console.log('  Fejl:', result.errors)
  }

  console.log('\nFærdig.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
