/**
 * renumber-cycling-blocks.ts
 *
 * Re-arrangér block_order kronologisk for et cykel-spil. Brug efter manuel
 * tilføjelse af løb hvor en blok ender på forkert plads (fx Dauphiné tilføjet
 * efter Tour og Vuelta, men starter før Tour).
 *
 * Kør: npm run renumber-cycling-blocks -- --game 42
 */

import { renumberCyclingBlocksByDate } from '../lib/generateCyclingBlocks'

const args = process.argv.slice(2)
const gameArgIdx = args.indexOf('--game')
const gameId = gameArgIdx >= 0 ? Number(args[gameArgIdx + 1]) : null

if (!gameId || isNaN(gameId)) {
  console.error('brug: npm run renumber-cycling-blocks -- --game <gameId>')
  process.exit(1)
}

async function main() {
  console.log(`renumberer cycling_blocks for game ${gameId} …`)
  await renumberCyclingBlocksByDate(gameId!)
  console.log('færdig')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
