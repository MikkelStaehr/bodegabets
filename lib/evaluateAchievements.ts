import { supabaseAdmin } from '@/lib/supabase'

/**
 * Evaluerer og tildeler achievements til en bruger i et specifikt spil.
 * Kaldes efter calculateRoundPoints og ved bet submission.
 * Idempotent — kan køres mange gange uden bivirkninger.
 */
export async function evaluateAchievements(userId: string, gameId: number): Promise<void> {
  console.log(`[evaluateAchievements] START userId=${userId.slice(0, 8)} gameId=${gameId}`)

  const earned: Array<{ user_id: string; achievement_key: string; game_id: number | null }> = []

  // ─── Hjælpefunktion til at tildele achievement ────────────────────────────
  async function award(key: string, gameIdOrNull: number | null = gameId) {
    // Tjek om allerede tildelt
    const { count } = await supabaseAdmin
      .from('user_achievements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('achievement_key', key)
      .eq('game_id', gameIdOrNull ?? -1)

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

  // ─── Hent grunddata ───────────────────────────────────────────────────────

  // Alle match_result bets med resultat
  const { data: matchResultBets } = await supabaseAdmin
    .from('bets')
    .select('id, match_id, result, stake, bet_type')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .in('result', ['win', 'loss'])

  // Alle round_scores for denne bruger i dette game
  const { data: roundScores } = await supabaseAdmin
    .from('round_scores')
    .select('round_id, points_earned, earnings_delta')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('round_id', { ascending: true })

  // Alle runder i spillet
  const { data: allRounds } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .in('season_id', await getSeasonIdsForGame(gameId))
    .eq('status', 'finished')
    .order('id', { ascending: true })

  const mrBets = (matchResultBets ?? []).filter(b => b.bet_type === 'match_result')
  const totalMRBets = mrBets.length
  const correctMRBets = mrBets.filter(b => b.result === 'win').length
  const correctPct = totalMRBets >= 20 ? (correctMRBets / totalMRBets) * 100 : null

  const scores = roundScores ?? []
  const rounds = allRounds ?? []

  // ─── PRÆCISION ────────────────────────────────────────────────────────────

  if (correctPct !== null) {
    if (correctPct >= 80) await award('maskinen')
    else if (correctPct >= 70) await award('oraklet')
    else if (correctPct >= 60) await award('analytikeren')

    if (correctPct < 40) await award('gætteren')
    if (correctPct < 25) await award('blindskud')
  }

  // ─── HISTORISKE ───────────────────────────────────────────────────────────

  // Veteranen — 10+ runder
  if (scores.length >= 10) await award('veteranen')

  // Trofast — aldrig misset en runde (min. 5 runder i spillet)
  if (rounds.length >= 5 && scores.length === rounds.length) {
    await award('trofast')
  }

  // Hattrick — vundet 3 runder i træk (højest points_earned)
  if (scores.length >= 3) {
    const roundIds = scores.map(s => s.round_id)
    let hattrick = false
    for (let i = 0; i <= roundIds.length - 3; i++) {
      const window = roundIds.slice(i, i + 3)
      const allWon = await Promise.all(window.map(rid => didWinRound(userId, gameId, rid)))
      if (allWon.every(Boolean)) { hattrick = true; break }
    }
    if (hattrick) await award('hattrick')
  }

  // Bundskraberen — vundet en runde fra sidstepladsen
  for (const score of scores) {
    const won = await didWinRound(userId, gameId, score.round_id)
    if (won) {
      const wasLast = await wasLastInRound(userId, gameId, score.round_id)
      if (wasLast) { await award('bundskraberen'); break }
    }
  }

  // Comebacket + Blokkongen + frame_gold + frame_crown — kræver blocks, stub
  // TODO: implementer når block system er klar

  // ─── STIL ─────────────────────────────────────────────────────────────────

  // All-in — total stake = 1000 på 5+ runder i træk
  if (scores.length >= 5) {
    let streak = 0
    for (const score of scores) {
      const { data: roundBets } = await supabaseAdmin
        .from('bets')
        .select('stake')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .eq('round_id', score.round_id)
        .eq('bet_type', 'match_result')
      const total = (roundBets ?? []).reduce((s, b) => s + (b.stake ?? 0), 0)
      if (total >= 1000) { streak++; if (streak >= 5) { await award('all_in'); break } }
      else streak = 0
    }
  }

  // Spareblussen — total stake < 100 på 5+ runder i træk
  if (scores.length >= 5) {
    let streak = 0
    for (const score of scores) {
      const { data: roundBets } = await supabaseAdmin
        .from('bets')
        .select('stake')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .eq('round_id', score.round_id)
        .eq('bet_type', 'match_result')
      const total = (roundBets ?? []).reduce((s, b) => s + (b.stake ?? 0), 0)
      if (total < 100) { streak++; if (streak >= 5) { await award('spareblussen'); break } }
      else streak = 0
    }
  }

  // Detaljeorienteret — ekstra bets på alle kampe i en runde 3+ gange
  let detaljeredeRunder = 0
  for (const score of scores) {
    const { data: roundMatches } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('round_id', score.round_id)

    const matchIds = (roundMatches ?? []).map(m => m.id)
    if (matchIds.length === 0) continue

    const { data: extraBets } = await supabaseAdmin
      .from('bets')
      .select('match_id')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .in('bet_type', ['goals_3plus', 'clean_sheet', 'win_margin'])
      .in('match_id', matchIds)

    const matchesWithExtra = new Set((extraBets ?? []).map(b => b.match_id))
    if (matchesWithExtra.size === matchIds.length) detaljeredeRunder++
    if (detaljeredeRunder >= 3) { await award('detaljeorienteret'); break }
  }

  // ─── EKSTRA BETS ──────────────────────────────────────────────────────────

  // Clean sheet fanatiker
  const correctCleanSheet = (matchResultBets ?? [])
    .filter(b => b.bet_type === 'clean_sheet' && b.result === 'win').length
  if (correctCleanSheet >= 5) await award('clean_sheet_fan')

  // Måljægeren
  const correctGoals3plus = (matchResultBets ?? [])
    .filter(b => b.bet_type === 'goals_3plus' && b.result === 'win').length
  if (correctGoals3plus >= 5) await award('måljægeren')

  // ─── PROFILRAMMER ─────────────────────────────────────────────────────────

  // Bronze — 5+ runder
  if (scores.length >= 5) await award('frame_bronze', null)

  // Sølv — vundet mindst én runde
  for (const score of scores) {
    const won = await didWinRound(userId, gameId, score.round_id)
    if (won) { await award('frame_silver', null); break }
  }

  // Ild — 100% korrekte match_result bets i en runde
  for (const score of scores) {
    const { data: roundMRBets } = await supabaseAdmin
      .from('bets')
      .select('result')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .eq('round_id', score.round_id)
      .eq('bet_type', 'match_result')
      .in('result', ['win', 'loss'])

    const rb = roundMRBets ?? []
    if (rb.length > 0 && rb.every(b => b.result === 'win')) {
      await award('frame_fire', null)
      break
    }
  }

  // frame_gold, frame_diamond, frame_crown — kræver blocks/sæsonafslutning
  // TODO: implementer når block system er klar

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

async function didWinRound(userId: string, gameId: number, roundId: number): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('round_scores')
    .select('points_earned, user_id')
    .eq('round_id', roundId)
    .eq('game_id', gameId)
    .order('points_earned', { ascending: false })
    .limit(1)

  return data?.[0]?.user_id === userId
}

async function wasLastInRound(userId: string, gameId: number, roundId: number): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('round_scores')
    .select('points_earned, user_id')
    .eq('round_id', roundId)
    .eq('game_id', gameId)
    .order('points_earned', { ascending: true })
    .limit(1)

  return data?.[0]?.user_id === userId
}
