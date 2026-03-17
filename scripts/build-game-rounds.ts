/**
 * build-game-rounds.ts
 * CLI-script: Kører syncSeasonViaBold for en sæson.
 * Kør: npm run build-game-rounds -- 1
 */

import { syncSeasonViaBold } from '../lib/syncLeagueMatches'

async function main() {
  const seasonId = parseInt(process.argv[2] ?? '1', 10)

  if (!seasonId) {
    console.error('Brug: npx ts-node scripts/build-game-rounds.ts <season_id>')
    process.exit(1)
  }

  console.log(`Kører syncSeasonViaBold(season_id=${seasonId})…`)

  const result = await syncSeasonViaBold(seasonId)

  console.log('\nResultat:')
  console.log(`  Kampe synket:    ${result.synced}`)
  console.log(`  Runder oprettet: ${result.rounds_created}`)
  console.log(`  Kampe oprettet:  ${result.matches_created}`)
  console.log(`  Kampe opdateret: ${result.matches_updated}`)
  if (result.errors.length) {
    console.log('  Fejl:', result.errors)
  }

  console.log('\nFærdig.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
