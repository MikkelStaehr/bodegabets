/**
 * restructure-vm-rounds.ts
 *
 * Omstrukturér VM-runder (season 25) til ~10-kamps-bundles + samlede knockout-faser.
 * Kør efter syncSeasonViaBold når VM-runder skal opdateres.
 *
 * npm run restructure-vm-rounds
 */

import { restructureVmRounds } from '../lib/restructureVmRounds'

async function main() {
  console.log('Omstrukturerer VM-runder (season 25) …\n')
  const result = await restructureVmRounds(25)
  console.log(`Rounds deleted:     ${result.rounds_deleted}`)
  console.log(`Rounds created:     ${result.rounds_created}`)
  console.log(`Matches reassigned: ${result.matches_reassigned}\n`)
  console.log('Ny struktur:')
  for (const r of result.rounds) {
    console.log(`  ${r.name.padEnd(30)} ${r.match_count} kampe`)
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
