import { supabaseAdmin } from '@/lib/supabase'

/**
 * Evaluerer og tildeler achievements til en bruger i et specifikt spil.
 * Kaldes efter calculateRoundPoints og ved bet submission.
 * Idempotent — kan køres mange gange uden bivirkninger.
 *
 * Optimeret: batch-fetcher data i starten, beregner i memory.
 */
export async function evaluateAchievements(userId: string, gameId: number): Promise<void> {
  console.log(`[evaluateAchievements] START userId=${userId.slice(0, 8)} gameId=${gameId}`)

  const earned: Array<{ user_id: string; achievement_key: string; game_id: number | null }> = []

  async function award(key: string, gameIdOrNull: number | null = gameId) {
    let query = supabaseAdmin
      .from('user_achievements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('achievement_key', key)

    if (gameIdOrNull === null) {
      query = query.is('game_id', null)
    } else {
      query = query.eq('game_id', gameIdOrNull)
    }

    const { count } = await query
    if (count && count > 0) return

    const { error } = await supabaseAdmin
      .from('user_achievements')
      .insert({ user_id: userId, achievement_key: key, game_id: gameIdOrNull })

    if (error) {
      console.error(`[evaluateAchievements] Fejl ved tildeling af ${key}:`, error.message)
    } else {
      console.log(`[evaluateAchievements] Tildelt: ${key}`)
      earned.push({ user_id: userId, achievement_key: key, game_id: gameIdOrNull })
    }
  }

  // ─── Batch-fetch al grunddata ────────────────────────────────────────────

  const seasonIds = await getSeasonIdsForGame(gameId)

  // Alle bets for denne bruger i dette spil (med resultat)
  const { data: allBets } = await supabaseAdmin
    .from('bets')
    .select('id, match_id, round_id, result, stake, bet_type')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .in('result', ['win', 'loss'])

  // Alle round_scores for denne bruger
  const { data: roundScores } = await supabaseAdmin
    .from('round_scores')
    .select('round_id, points_earned, earnings_delta')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('round_id', { ascending: true })

  // Alle finished runder i spillet
  const { data: allRounds } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .in('season_id', seasonIds.length > 0 ? seasonIds : [0])
    .eq('status', 'finished')
    .order('id', { ascending: true })

  // Alle round_scores for ALLE brugere i dette spil (for win/last beregning)
  const roundIds = (roundScores ?? []).map(s => s.round_id)
  const { data: allGameRoundScores } = roundIds.length > 0
    ? await supabaseAdmin
        .from('round_scores')
        .select('round_id, user_id, points_earned')
        .eq('game_id', gameId)
        .in('round_id', roundIds)
    : { data: [] as { round_id: number; user_id: string; points_earned: number }[] }

  // Alle matches for relevante runder (for detaljeorienteret)
  const { data: allRoundMatches } = roundIds.length > 0
    ? await supabaseAdmin
        .from('matches')
        .select('id, round_id')
        .in('round_id', roundIds)
    : { data: [] as { id: number; round_id: number }[] }

  // ─── Beregn win/last per runde i memory ──────────────────────────────────

  const roundWinners = new Map<number, string>()   // round_id → winner user_id
  const roundLosers = new Map<number, string>()    // round_id → last user_id

  const scoresByRound = new Map<number, { user_id: string; points: number }[]>()
  for (const s of allGameRoundScores ?? []) {
    if (!scoresByRound.has(s.round_id)) scoresByRound.set(s.round_id, [])
    scoresByRound.get(s.round_id)!.push({ user_id: s.user_id, points: s.points_earned })
  }
  for (const [rid, entries] of scoresByRound) {
    entries.sort((a, b) => b.points - a.points)
    if (entries.length > 0) roundWinners.set(rid, entries[0].user_id)
    if (entries.length > 0) roundLosers.set(rid, entries[entries.length - 1].user_id)
  }

  // Bet totals per runde (match_result bets)
  const betsByRound = new Map<number, number>() // round_id → total stake
  const mrBetsByRound = new Map<number, { result: string }[]>()
  for (const b of allBets ?? []) {
    if (b.bet_type === 'match_result' && b.round_id) {
      betsByRound.set(b.round_id, (betsByRound.get(b.round_id) ?? 0) + (b.stake ?? 0))
      if (!mrBetsByRound.has(b.round_id)) mrBetsByRound.set(b.round_id, [])
      mrBetsByRound.get(b.round_id)!.push({ result: b.result })
    }
  }

  // Matches per runde
  const matchesByRound = new Map<number, number[]>()
  for (const m of allRoundMatches ?? []) {
    if (!matchesByRound.has(m.round_id)) matchesByRound.set(m.round_id, [])
    matchesByRound.get(m.round_id)!.push(m.id)
  }

  // Extra bets per match
  const extraBetMatches = new Map<number, Set<number>>() // round_id → set of match_ids with extra bets
  for (const b of allBets ?? []) {
    if (['goals_3plus', 'clean_sheet', 'win_margin'].includes(b.bet_type) && b.round_id && b.match_id) {
      if (!extraBetMatches.has(b.round_id)) extraBetMatches.set(b.round_id, new Set())
      extraBetMatches.get(b.round_id)!.add(b.match_id)
    }
  }

  // ─── Derived data ────────────────────────────────────────────────────────

  const mrBets = (allBets ?? []).filter(b => b.bet_type === 'match_result')
  const totalMRBets = mrBets.length
  const correctMRBets = mrBets.filter(b => b.result === 'win').length
  const correctPct = totalMRBets >= 20 ? (correctMRBets / totalMRBets) * 100 : null

  const scores = roundScores ?? []
  const rounds = allRounds ?? []

  function didWin(roundId: number): boolean {
    return roundWinners.get(roundId) === userId
  }

  function wasLast(roundId: number): boolean {
    return roundLosers.get(roundId) === userId
  }

  // ─── PRÆCISION ────────────────────────────────────────────────────────────

  if (correctPct !== null) {
    if (correctPct >= 80) await award('maskinen')
    else if (correctPct >= 70) await award('oraklet')
    else if (correctPct >= 60) await award('analytikeren')

    if (correctPct < 40) await award('gætteren')
    if (correctPct < 25) await award('blindskud')
  }

  // ─── HISTORISKE ───────────────────────────────────────────────────────────

  if (scores.length >= 10) await award('veteranen')

  if (rounds.length >= 5 && scores.length === rounds.length) {
    await award('trofast')
  }

  // Hattrick — vundet 3 runder i træk
  if (scores.length >= 3) {
    let streak = 0
    for (const score of scores) {
      if (didWin(score.round_id)) { streak++; if (streak >= 3) break }
      else streak = 0
    }
    if (streak >= 3) await award('hattrick')
  }

  // Bundskraberen — vundet en runde fra sidstepladsen
  for (const score of scores) {
    if (didWin(score.round_id) && wasLast(score.round_id)) {
      await award('bundskraberen')
      break
    }
  }

  // ─── STIL ─────────────────────────────────────────────────────────────────

  // All-in — total stake = 1000 på 5+ runder i træk
  if (scores.length >= 5) {
    let streak = 0
    for (const score of scores) {
      const total = betsByRound.get(score.round_id) ?? 0
      if (total >= 1000) { streak++; if (streak >= 5) { await award('all_in'); break } }
      else streak = 0
    }
  }

  // Spareblussen — total stake < 100 på 5+ runder i træk
  if (scores.length >= 5) {
    let streak = 0
    for (const score of scores) {
      const total = betsByRound.get(score.round_id) ?? 0
      if (total < 100) { streak++; if (streak >= 5) { await award('spareblussen'); break } }
      else streak = 0
    }
  }

  // Detaljeorienteret — ekstra bets på alle kampe i en runde 3+ gange
  let detaljeredeRunder = 0
  for (const score of scores) {
    const matchIds = matchesByRound.get(score.round_id)
    if (!matchIds || matchIds.length === 0) continue
    const extraMatches = extraBetMatches.get(score.round_id)
    if (extraMatches && extraMatches.size === matchIds.length) detaljeredeRunder++
    if (detaljeredeRunder >= 3) { await award('detaljeorienteret'); break }
  }

  // ─── EKSTRA BETS ──────────────────────────────────────────────────────────

  const correctCleanSheet = (allBets ?? [])
    .filter(b => b.bet_type === 'clean_sheet' && b.result === 'win').length
  if (correctCleanSheet >= 5) await award('clean_sheet_fan')

  const correctGoals3plus = (allBets ?? [])
    .filter(b => b.bet_type === 'goals_3plus' && b.result === 'win').length
  if (correctGoals3plus >= 5) await award('måljægeren')

  // ─── PROFILRAMMER ─────────────────────────────────────────────────────────

  if (scores.length >= 5) await award('frame_bronze', null)

  for (const score of scores) {
    if (didWin(score.round_id)) { await award('frame_silver', null); break }
  }

  // Ild — 100% korrekte match_result bets i en runde
  for (const score of scores) {
    const rb = mrBetsByRound.get(score.round_id) ?? []
    if (rb.length > 0 && rb.every(b => b.result === 'win')) {
      await award('frame_fire', null)
      break
    }
  }

  console.log(`[evaluateAchievements] DONE — ${earned.length} nye achievements tildelt`)
}

// ─── Hjælpefunktioner ──────────────────────────────────────────────────────

async function getSeasonIdsForGame(gameId: number): Promise<number[]> {
  const { data } = await supabaseAdmin
    .from('game_seasons')
    .select('season_id')
    .eq('game_id', gameId)
  return (data ?? []).map(gs => gs.season_id as number)
}
