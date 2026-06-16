/**
 * Blok Bets — overordnede bets der spænder over HELE blokken (alle blokkens
 * kampe samlet) i stedet for en enkelt kamp. Lægges én gang ved blok-start og
 * afgøres når blokken er færdigspillet.
 *
 * v1 bruger kun mål/resultat-data vi har 100% pålideligt (ingen ekstern
 * stats-afhængighed). Faste, designede odds vist på forhånd.
 *
 * Pure module — ingen DB-kald. Markeds-defs er én kilde til sandhed for både
 * scoring (lib/scoreBlockBets) og UI/reglebog.
 */

export type BlockMatchRow = {
  home_score: number | null
  away_score: number | null
  status: string
}

export type BlockBetStats = {
  /** Antal AFGJORTE kampe i blokken (kun finished tæller). */
  matchCount: number
  totalGoals: number
  draws: number
  homeWins: number
  awayWins: number
  /** Hold der holdt buret rent (tæller pr. hold, så 0-0 = 2). */
  cleanSheets: number
  /** Kampe med 5+ mål i alt. */
  bigGames: number
}

export function computeBlockBetStats(matches: BlockMatchRow[]): BlockBetStats {
  const s: BlockBetStats = { matchCount: 0, totalGoals: 0, draws: 0, homeWins: 0, awayWins: 0, cleanSheets: 0, bigGames: 0 }
  for (const m of matches) {
    if (m.status !== 'finished' || m.home_score == null || m.away_score == null) continue
    const h = m.home_score, a = m.away_score
    s.matchCount++
    s.totalGoals += h + a
    if (h === a) s.draws++
    else if (h > a) s.homeWins++
    else s.awayWins++
    if (a === 0) s.cleanSheets++
    if (h === 0) s.cleanSheets++
    if (h + a >= 5) s.bigGames++
  }
  return s
}

export type BlockBetSide = { value: string; label: string; odds: number }

export type BlockBetMarket = {
  key: string
  /** Kort markedsnavn til UI. */
  label: string
  /** Forventet antal kampe pr. blok bruges til at sætte linjer (VM: 8). */
  /** Over/under-linje (kun for ou-markeder), beregnet ud fra antal kampe. */
  line?: (matchCount: number) => number
  /** Sider man kan vælge (med faste odds). */
  sides: (matchCount: number) => BlockBetSide[]
  /** Det faktiske tal markedet afgøres på. */
  actual: (s: BlockBetStats) => number
  /** Vindende side ud fra de samlede stats (null hvis ingen kampe endnu). */
  resolve: (s: BlockBetStats) => string | null
  /** En-linjes forklaring til reglebog/briefing. */
  describe: (matchCount: number) => string
}

// .5-linje (ingen "push") sat ud fra en rate pr. kamp.
const halfLine = (matchCount: number, perMatch: number) => Math.floor(matchCount * perMatch) + 0.5
const OU = (line: number): BlockBetSide[] => [
  { value: 'over', label: `Over ${line}`, odds: 1.85 },
  { value: 'under', label: `Under ${line}`, odds: 1.85 },
]
const ouResolve = (line: (n: number) => number, actual: (s: BlockBetStats) => number) =>
  (s: BlockBetStats): string | null => (s.matchCount === 0 ? null : (actual(s) > line(s.matchCount) ? 'over' : 'under'))

export const BLOCK_BET_MARKETS: BlockBetMarket[] = [
  {
    key: 'goals_ou',
    label: 'Mål i blokken',
    line: (n) => halfLine(n, 2.6),
    sides: (n) => OU(halfLine(n, 2.6)),
    actual: (s) => s.totalGoals,
    resolve: ouResolve((n) => halfLine(n, 2.6), (s) => s.totalGoals),
    describe: (n) => `Samlet antal mål i blokkens ${n} kampe — over/under ${halfLine(n, 2.6)}.`,
  },
  {
    key: 'draws_ou',
    label: 'Uafgjorte',
    line: (n) => halfLine(n, 0.28),
    sides: (n) => OU(halfLine(n, 0.28)),
    actual: (s) => s.draws,
    resolve: ouResolve((n) => halfLine(n, 0.28), (s) => s.draws),
    describe: (n) => `Antal uafgjorte kampe i blokken — over/under ${halfLine(n, 0.28)}.`,
  },
  {
    key: 'home_wins_ou',
    label: 'Hjemmesejre',
    line: (n) => halfLine(n, 0.45),
    sides: (n) => OU(halfLine(n, 0.45)),
    actual: (s) => s.homeWins,
    resolve: ouResolve((n) => halfLine(n, 0.45), (s) => s.homeWins),
    describe: (n) => `Antal hjemmesejre i blokken — over/under ${halfLine(n, 0.45)}.`,
  },
  {
    key: 'clean_sheets_ou',
    label: 'Clean sheets',
    line: (n) => halfLine(n, 0.6),
    sides: (n) => OU(halfLine(n, 0.6)),
    actual: (s) => s.cleanSheets,
    resolve: ouResolve((n) => halfLine(n, 0.6), (s) => s.cleanSheets),
    describe: (n) => `Antal clean sheets (hold der holdt buret rent) — over/under ${halfLine(n, 0.6)}.`,
  },
  {
    key: 'big_game',
    label: 'Måfest',
    sides: () => [
      { value: 'yes', label: 'Ja', odds: 1.5 },
      { value: 'no', label: 'Nej', odds: 2.4 },
    ],
    actual: (s) => s.bigGames,
    resolve: (s) => (s.matchCount === 0 ? null : (s.bigGames >= 1 ? 'yes' : 'no')),
    describe: () => 'Mindst én kamp i blokken med 5+ mål?',
  },
]

export function getBlockBetMarket(key: string): BlockBetMarket | undefined {
  return BLOCK_BET_MARKETS.find((m) => m.key === key)
}

/** Odds for en bestemt side i et marked (til validering server-side). */
export function blockBetOdds(key: string, selection: string, matchCount: number): number | null {
  const m = getBlockBetMarket(key)
  if (!m) return null
  return m.sides(matchCount).find((s) => s.value === selection)?.odds ?? null
}
