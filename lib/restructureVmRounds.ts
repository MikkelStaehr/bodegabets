/**
 * VM-specifik runde-omstrukturering.
 *
 * Bold's sync giver os 35 runder (én pr. kampdag) — for fint-kornet til en
 * sæson-betting-kupon. Vi grupperer i stedet:
 *
 *   - Gruppespil: ~10 kampe pr. runde, fra første gruppespils-kamp til sidste.
 *     Splittes på dato-grænser (vi ramme ikke præcis 10 men 9-11 pr runde).
 *   - Knockout-faser: én runde pr fase (1/16-finale, Ottendedelsfinale,
 *     Kvartfinale, Semifinale, Bronzekamp, Finale).
 *
 * Idempotent: kan køres flere gange. Eksisterende rounds for sæsonen slettes
 * og genskabes; matches re-bindes til de nye round-ids.
 *
 * Brug: kald fra et script eller efter syncSeasonViaBold for VM-sæsoner.
 */

import { supabaseAdmin } from '@/lib/supabase'

const TARGET_GROUP_STAGE_ROUND_SIZE = 10

const KNOCKOUT_ORDER = [
  '1/16-finale',
  'Ottendedelsfinale',
  'Kvartfinale',
  'Semifinale',
  'Bronzekamp',
  'Finale',
] as const

function classifyStage(boldRound: string): { stage: string; isKnockout: boolean } {
  const lc = (boldRound ?? '').toLowerCase()
  if (lc.includes('final') && !lc.includes('semi') && !lc.includes('kvart') && !lc.includes('1/16') && !lc.includes('ottende')) {
    return { stage: 'Finale', isKnockout: true }
  }
  if (lc.includes('bronze')) return { stage: 'Bronzekamp', isKnockout: true }
  if (lc.includes('semi')) return { stage: 'Semifinale', isKnockout: true }
  if (lc.includes('kvart')) return { stage: 'Kvartfinale', isKnockout: true }
  if (lc.includes('ottende')) return { stage: 'Ottendedelsfinale', isKnockout: true }
  if (lc.includes('1/16')) return { stage: '1/16-finale', isKnockout: true }
  return { stage: 'Gruppespil', isKnockout: false }
}

export type RestructureResult = {
  rounds_deleted: number
  rounds_created: number
  matches_reassigned: number
  rounds: { name: string; match_count: number }[]
}

export async function restructureVmRounds(seasonId: number): Promise<RestructureResult> {
  // 1. Hent alle matches for sæsonen — sorteret kronologisk
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, round_id, kickoff, status')
    .eq('season_id', seasonId)
    .order('kickoff', { ascending: true })

  if (!matches?.length) {
    return { rounds_deleted: 0, rounds_created: 0, matches_reassigned: 0, rounds: [] }
  }

  // 2. Hent eksisterende rounds + name for at klassificere matches' stage
  const existingRoundIds = [...new Set((matches).map((m) => m.round_id as number).filter(Boolean))]
  const { data: existingRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, season_id')
    .eq('season_id', seasonId)
  const roundNameById = new Map<number, string>()
  for (const r of existingRounds ?? []) roundNameById.set(r.id as number, r.name as string)

  // 3. Klassificér hver match efter stage via round-navn
  type MatchEntry = { id: number; kickoff: string; stage: string; isKnockout: boolean }
  const classified: MatchEntry[] = (matches).map((m) => {
    const roundName = m.round_id ? (roundNameById.get(m.round_id as number) ?? '') : ''
    const { stage, isKnockout } = classifyStage(roundName)
    return {
      id: m.id as number,
      kickoff: m.kickoff as string,
      stage,
      isKnockout,
    }
  })

  // 4. Byg nye round-grupper
  const groups: { name: string; matchIds: number[]; firstKickoff: string }[] = []

  // 4a. Gruppespil — sortér efter kickoff, opdel i bundles a ~10
  const groupStageMatches = classified.filter((m) => !m.isKnockout)
  groupStageMatches.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  let bundleIndex = 1
  for (let i = 0; i < groupStageMatches.length; i += TARGET_GROUP_STAGE_ROUND_SIZE) {
    const bundle = groupStageMatches.slice(i, i + TARGET_GROUP_STAGE_ROUND_SIZE)
    groups.push({
      name: `Gruppespil · Runde ${bundleIndex}`,
      matchIds: bundle.map((m) => m.id),
      firstKickoff: bundle[0].kickoff,
    })
    bundleIndex++
  }

  // 4b. Knockout-faser — én runde pr fase i kronologisk rækkefølge
  for (const stageName of KNOCKOUT_ORDER) {
    const stageMatches = classified.filter((m) => m.isKnockout && m.stage === stageName)
    if (stageMatches.length === 0) continue
    stageMatches.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    groups.push({
      name: stageName,
      matchIds: stageMatches.map((m) => m.id),
      firstKickoff: stageMatches[0].kickoff,
    })
  }

  // 5. Slet eksisterende rounds for sæsonen.
  //    Tre FK-relationer skal håndteres først:
  //    - matches.round_id (CASCADE / SET NULL er ikke garanteret) → unbind
  //    - round_members.round_id (oprettes af /update-bet-open daglig cron) → cascade-delete
  //    - round_bets.round_id (brugernes bets) → cascade-delete
  //
  //    VIGTIGT: vi sletter for ALLE rounds i sæsonen, ikke kun dem med
  //    matches. Tidligere bug: existingRoundIds kom kun fra matches' round_ids
  //    så ghost-rounds (oprettet af tidligere restructure men hvor matches
  //    var flyttet til nye date-baserede rounds) blev ikke fanget. FK fejlede,
  //    restructure crashed, batch-sync føjede flere date-rounds.
  await supabaseAdmin.from('matches').update({ round_id: null }).eq('season_id', seasonId).throwOnError()
  const allSeasonRoundIds = (existingRounds ?? []).map((r) => r.id as number)
  if (allSeasonRoundIds.length > 0) {
    // bets er match_id-baseret, ikke round_id, så de mister ikke deres
    // forbindelse til kampe når rounds genskabes. Kun round_members har
    // FK på round_id og skal cleanes.
    await supabaseAdmin.from('round_members').delete().in('round_id', allSeasonRoundIds).throwOnError()
  }
  const { error: delErr } = await supabaseAdmin.from('rounds').delete().eq('season_id', seasonId)
  if (delErr) throw delErr
  const roundsDeleted = allSeasonRoundIds.length

  // 6. Opret nye rounds — betting_closes_at = 30 minutter før første kamp i bundle.
  //    bet_open: true så runden er åben for betting med det samme. Uden den
  //    flag dukkede runder ikke op i ActiveRounds-listen og brugere så
  //    "Ingen åbne runder lige nu" selvom kampprogrammet var synligt.
  const newRoundRows = groups.map((g) => {
    const firstMs = new Date(g.firstKickoff).getTime()
    const closesAt = new Date(firstMs - 30 * 60 * 1000).toISOString()
    return {
      season_id: seasonId,
      name: g.name,
      status: 'upcoming',
      betting_closes_at: closesAt,
      bet_open: true,
    }
  })

  const { data: insertedRounds, error: insErr } = await supabaseAdmin
    .from('rounds').insert(newRoundRows).select('id, name')
  if (insErr) throw insErr

  const newRoundIdByName = new Map<string, number>()
  for (const r of insertedRounds ?? []) newRoundIdByName.set(r.name as string, r.id as number)

  // 7. Re-bind matches til nye rounds
  let matchesReassigned = 0
  for (const g of groups) {
    const roundId = newRoundIdByName.get(g.name)
    if (!roundId) continue
    const { error: updErr } = await supabaseAdmin
      .from('matches').update({ round_id: roundId }).in('id', g.matchIds)
    if (updErr) throw updErr
    matchesReassigned += g.matchIds.length
  }

  return {
    rounds_deleted: roundsDeleted,
    rounds_created: groups.length,
    matches_reassigned: matchesReassigned,
    rounds: groups.map((g) => ({ name: g.name, match_count: g.matchIds.length })),
  }
}
