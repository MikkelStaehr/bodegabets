import { supabaseAdmin } from '@/lib/supabase'

interface TeamStats {
  winRate: number      // 0-1
  formScore: number    // 0-1 baseret på seneste 5 kampe
  tablePosition: number
}

interface HistoricFactors {
  home: number   // faktor for hjemmehold sejr
  draw: number   // faktor for uafgjort
  away: number   // faktor for udehold sejr
}

// Henter holdets stats fra league_matches
async function getTeamStats(
  team: string,
  leagueId: number,
  isHome: boolean
): Promise<TeamStats> {

  // 1. Hjemme/ude win-rate (40% vægt)
  const { data: allMatches } = await supabaseAdmin
    .from('league_matches')
    .select('home_team, away_team, home_score, away_score')
    .eq('league_id', leagueId)
    .eq(isHome ? 'home_team' : 'away_team', team)
    .eq('status', 'finished')

  const total = allMatches?.length ?? 0
  const wins = allMatches?.filter(m =>
    isHome ? m.home_score! > m.away_score! : m.away_score! > m.home_score!
  ).length ?? 0
  const winRate = total > 0 ? wins / total : 0.33

  // 2. Seneste 5 kampe form (30% vægt)
  const { data: recent } = await supabaseAdmin
    .from('league_matches')
    .select('home_team, away_team, home_score, away_score')
    .eq('league_id', leagueId)
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: false })
    .limit(5)

  const formPoints = (recent ?? []).reduce((sum, m) => {
    const isHomeInMatch = m.home_team === team
    const won = isHomeInMatch ? m.home_score! > m.away_score! : m.away_score! > m.home_score!
    const drew = m.home_score === m.away_score
    return sum + (won ? 3 : drew ? 1 : 0)
  }, 0)
  const formScore = formPoints / 15 // max 15 point (5×3)

  // 3. Ligaplacering (20% vægt) — beregn tabelposition
  const { data: allTeamResults } = await supabaseAdmin
    .from('league_matches')
    .select('home_team, away_team, home_score, away_score')
    .eq('league_id', leagueId)
    .eq('status', 'finished')

  const pointsMap = new Map<string, number>()
  for (const m of allTeamResults ?? []) {
    if (!pointsMap.has(m.home_team)) pointsMap.set(m.home_team, 0)
    if (!pointsMap.has(m.away_team)) pointsMap.set(m.away_team, 0)
    if (m.home_score! > m.away_score!) {
      pointsMap.set(m.home_team, (pointsMap.get(m.home_team) ?? 0) + 3)
    } else if (m.home_score === m.away_score) {
      pointsMap.set(m.home_team, (pointsMap.get(m.home_team) ?? 0) + 1)
      pointsMap.set(m.away_team, (pointsMap.get(m.away_team) ?? 0) + 1)
    } else {
      pointsMap.set(m.away_team, (pointsMap.get(m.away_team) ?? 0) + 3)
    }
  }

  const sorted = [...pointsMap.entries()].sort((a, b) => b[1] - a[1])
  const tablePosition = sorted.findIndex(([t]) => t === team) + 1

  return { winRate, formScore, tablePosition }
}

// Beregn ligaens totale hold-antal til normalisering
async function getLeagueSize(leagueId: number): Promise<number> {
  const { data } = await supabaseAdmin
    .from('league_matches')
    .select('home_team')
    .eq('league_id', leagueId)
    .eq('status', 'finished')
  const teams = new Set(data?.map(m => m.home_team) ?? [])
  return Math.max(teams.size, 1)
}

// Hovedfunktion — beregn historiske faktorer for en kamp
export async function calculateHistoricFactors(
  homeTeam: string,
  awayTeam: string,
  leagueId: number
): Promise<HistoricFactors> {

  const [homeStats, awayStats, leagueSize] = await Promise.all([
    getTeamStats(homeTeam, leagueId, true),
    getTeamStats(awayTeam, leagueId, false),
    getLeagueSize(leagueId)
  ])

  // Indbyrdes historik (10% vægt)
  const { data: h2h } = await supabaseAdmin
    .from('league_matches')
    .select('home_team, home_score, away_score')
    .eq('league_id', leagueId)
    .eq('status', 'finished')
    .or(
      `and(home_team.eq.${homeTeam},away_team.eq.${awayTeam}),` +
      `and(home_team.eq.${awayTeam},away_team.eq.${homeTeam})`
    )

  const h2hTotal = h2h?.length ?? 0
  const h2hHomeWins = h2h?.filter(m =>
    (m.home_team === homeTeam && m.home_score! > m.away_score!) ||
    (m.home_team === awayTeam && m.away_score! > m.home_score!)
  ).length ?? 0
  const h2hHomeRate = h2hTotal > 0 ? h2hHomeWins / h2hTotal : 0.45

  // Placerings-forskel normaliseret
  const posDiff = (awayStats.tablePosition - homeStats.tablePosition) / leagueSize

  // Samlet sandsynlighed for hjemmehold-sejr (vægtet)
  const homeProb = Math.min(0.85, Math.max(0.10,
    homeStats.winRate    * 0.40 +
    homeStats.formScore  * 0.30 +
    (0.5 + posDiff * 0.5) * 0.20 +  // højere position = højere prob
    h2hHomeRate          * 0.10
  ))

  // Uafgjort sandsynlighed (typisk 20-30% i fodbold)
  const drawProb = Math.min(0.35, Math.max(0.12, 0.26 - Math.abs(homeProb - 0.5) * 0.3))

  // Udehold-sandsynlighed
  const awayProb = Math.max(0.05, 1 - homeProb - drawProb)

  // Konverter sandsynlighed til faktor — jo lavere sandsynlighed, jo højere faktor
  const probToFactor = (prob: number): number => {
    if (prob > 0.70) return 1.0 + (1 - prob) * 0.7
    if (prob > 0.50) return 1.2 + (0.70 - prob) * 2.0
    if (prob > 0.30) return 1.6 + (0.50 - prob) * 3.0
    if (prob > 0.15) return 2.2 + (0.30 - prob) * 8.7
    return 3.5 + (0.15 - prob) * 10.0
  }

  return {
    home: Math.round(probToFactor(homeProb) * 10) / 10,
    draw: Math.round(probToFactor(drawProb) * 10) / 10,
    away: Math.round(probToFactor(awayProb) * 10) / 10,
  }
}
