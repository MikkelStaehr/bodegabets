/**
 * build-game-rounds.ts
 * CLI-script: Kører buildGameRounds for et spilrum.
 * Kør: npm run build-game-rounds -- 7
 * Eller: npx dotenv -e .env.local -- npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/build-game-rounds.ts 7
 */

import { buildGameRounds } from '../lib/syncLeagueMatches'

async function main() {
  const gameId = parseInt(process.argv[2] ?? '7', 10)
  const leagueId = parseInt(process.argv[3] ?? '1', 10)

  if (!gameId || !leagueId) {
    console.error('Brug: npx ts-node scripts/build-game-rounds.ts <game_id> [league_id]')
    process.exit(1)
  }

  console.log(`Kører buildGameRounds(game_id=${gameId}, league_id=${leagueId})…`)

  const result = await buildGameRounds(gameId, leagueId)

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
