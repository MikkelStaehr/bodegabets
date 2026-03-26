import { supabaseAdmin } from '@/lib/supabase'

const ROUNDS_PER_BLOCK = 6

/**
 * Auto-genererer blocks for en sæson baseret på dens runder.
 *
 * Regler:
 * - 6 runder per block som udgangspunkt
 * - Resterende runder (< 6) lægges på den SIDSTE block
 * - Kun runder med status 'upcoming' eller 'open' medtages
 * - Sorteres på id (kronologisk rækkefølge)
 * - Idempotent: gør ingenting hvis blocks allerede eksisterer for sæsonen
 */
export async function generateBlocksForSeason(seasonId: number): Promise<void> {
  // Hent upcoming/open runder sorteret på id
  const { data: rounds, error: roundsError } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .eq('season_id', seasonId)
    .in('status', ['upcoming', 'open'])
    .order('id', { ascending: true })

  if (roundsError) {
    console.error(`[generateBlocks] Fejl ved hentning af runder for sæson ${seasonId}:`, roundsError)
    return
  }

  if (!rounds?.length) {
    console.log(`[generateBlocks] Ingen runder for sæson ${seasonId} — springer over`)
    return
  }

  // Tjek om blocks allerede eksisterer for sæsonen
  const { count: existingCount } = await supabaseAdmin
    .from('blocks')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)

  if (existingCount && existingCount > 0) {
    console.log(`[generateBlocks] Blocks eksisterer allerede for sæson ${seasonId} — springer over`)
    return
  }

  // Beregn antal blocks:
  // Første N-1 blokke får 6 runder, den sidste får resten (≥ 6)
  // Eksempel: 14 runder → 2 blokke: [6, 8]
  // Eksempel:  4 runder → 1 blok:   [4]
  const numBlocks = Math.max(1, Math.floor(rounds.length / ROUNDS_PER_BLOCK))

  const segments: number[][] = []
  for (let i = 0; i < numBlocks; i++) {
    const start = i * ROUNDS_PER_BLOCK
    const end = i < numBlocks - 1 ? start + ROUNDS_PER_BLOCK : rounds.length
    segments.push(rounds.slice(start, end).map((r) => r.id))
  }

  // INSERT blocks og få id'er tilbage
  const { data: insertedBlocks, error: insertError } = await supabaseAdmin
    .from('blocks')
    .insert(
      segments.map((_, i) => ({
        season_id: seasonId,
        block_number: i + 1,
        name: `Block ${i + 1}`,
        status: 'upcoming',
      }))
    )
    .select('id, block_number')

  if (insertError || !insertedBlocks?.length) {
    console.error(`[generateBlocks] Fejl ved insert af blocks for sæson ${seasonId}:`, insertError)
    return
  }

  // Sortér på block_number for korrekt mapping til segments
  insertedBlocks.sort((a, b) => a.block_number - b.block_number)

  // UPDATE rounds med block_id
  for (let i = 0; i < numBlocks; i++) {
    const blockId = insertedBlocks[i].id
    const roundIds = segments[i]

    const { error: updateError } = await supabaseAdmin
      .from('rounds')
      .update({ block_id: blockId })
      .in('id', roundIds)

    if (updateError) {
      console.error(`[generateBlocks] Fejl ved opdatering af runder for block ${i + 1} (sæson ${seasonId}):`, updateError)
    }
  }

  console.log(
    `[generateBlocks] Oprettede ${numBlocks} blocks for sæson ${seasonId}` +
    ` (${rounds.length} runder: ${segments.map((s, i) => `block ${i + 1}=${s.length}`).join(', ')})`
  )
}
