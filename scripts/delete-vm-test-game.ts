/**
 * delete-vm-test-game.ts
 *
 * Sletter det forkert oprettede VM-test-gameroom (game_id=57) samt de
 * tilknyttede rounds/blocks/matches for season 25 (FIFA VM 2026).
 *
 * Behold:
 *   - season 25 selv (FIFA VM 2026 — korrekt data)
 *   - championship_rounds-tabellen (test-data fra april, ikke VM-relateret)
 *
 * Slet:
 *   - 104 matches for season_id=25
 *   - 35 rounds for season_id=25
 *   - 1 block for season_id=25
 *   - 1 game_seasons-link (game_id=57)
 *   - 1 game_members-row (host)
 *   - 1 games-row (id=57)
 *
 * Brug: npm run delete-vm-test-game [-- --dry-run]
 */

import { supabaseAdmin } from '../lib/supabase'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  console.log(`[delete-vm-test-game] dry-run=${dryRun}\n`)

  // Verificér state først
  const { data: game } = await supabaseAdmin
    .from('games').select('id, name, sport').eq('id', 57).single()
  if (!game) {
    console.log('Game 57 findes ikke længere — intet at slette.')
    return
  }
  console.log(`Game 57: "${game.name}" (${game.sport})`)

  // Tæl dependencies
  const counts: Record<string, number> = {}
  for (const [tbl, filter] of [
    ['matches', { season_id: 25 }],
    ['rounds', { season_id: 25 }],
    ['blocks', { season_id: 25 }],
    ['game_seasons', { game_id: 57 }],
    ['game_members', { game_id: 57 }],
    ['bets', { game_id: 57 }],
    ['round_members', { game_id: 57 }],
    ['round_scores', { game_id: 57 }],
  ] as const) {
    let q = supabaseAdmin.from(tbl).select('id', { count: 'exact', head: true })
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as never)
    const { count } = await q
    counts[tbl] = count ?? 0
    console.log(`  ${tbl}: ${count ?? 0}`)
  }

  if (dryRun) {
    console.log('\n[dry-run] Ingen sletninger udført.')
    return
  }

  console.log('\nSletter …')

  // Rækkefølge: child først, parent sidst (selv hvis CASCADE er sat)
  // Bets/round_scores/round_members for game 57 først (i tilfælde af nogen)
  await supabaseAdmin.from('bets').delete().eq('game_id', 57).throwOnError()
  await supabaseAdmin.from('round_members').delete().eq('game_id', 57).throwOnError()
  await supabaseAdmin.from('round_scores').delete().eq('game_id', 57).throwOnError()
  console.log('  ✓ bets/round_members/round_scores slettet')

  // Matches for season 25
  const { error: matchErr } = await supabaseAdmin.from('matches').delete().eq('season_id', 25)
  if (matchErr) throw matchErr
  console.log(`  ✓ ${counts.matches} matches slettet`)

  // Rounds for season 25
  await supabaseAdmin.from('rounds').delete().eq('season_id', 25).throwOnError()
  console.log(`  ✓ ${counts.rounds} rounds slettet`)

  // Blocks for season 25
  await supabaseAdmin.from('blocks').delete().eq('season_id', 25).throwOnError()
  console.log(`  ✓ ${counts.blocks} blocks slettet`)

  // game_seasons-link
  await supabaseAdmin.from('game_seasons').delete().eq('game_id', 57).throwOnError()
  console.log('  ✓ game_seasons-link slettet')

  // game_members
  await supabaseAdmin.from('game_members').delete().eq('game_id', 57).throwOnError()
  console.log('  ✓ game_members slettet')

  // Games selv
  await supabaseAdmin.from('games').delete().eq('id', 57).throwOnError()
  console.log('  ✓ games row 57 slettet')

  console.log('\nFærdig. Season 25 (FIFA VM 2026) er bevaret og kan bruges til nyt gameroom.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
