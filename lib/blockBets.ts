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

export type BlockBetSide = { value: string; label: string }

// Konsensus-odds — SAMME limits som kamp-bets (match_result: 1.2–1.8). Odds er
// ikke faste, men beregnes ved lås ud fra hvor mange der backede markedet:
// populært valg → lavere odds (ned mod 1.2), upopulært → op mod 1.8.
export const BLOCK_BET_MIN_ODDS = 1.2
export const BLOCK_BET_BASE_ODDS = 1.8

/**
 * Konsensus-odds for et Blok Bet-marked. `backers` = antal der lagde dette
 * marked, `participants` = antal spillere der lagde mindst ét Blok Bet i
 * blokken (pr. spil). Spejler kamp-formlen: max(1.2, 1.8 − pct·0.6).
 */
export function blockBetConsensusOdds(backers: number, participants: number): number {
  if (participants === 0 || backers === 0) return BLOCK_BET_BASE_ODDS
  const pct = backers / participants
  return Math.round(Math.max(BLOCK_BET_MIN_ODDS, BLOCK_BET_BASE_ODDS - pct * 0.6) * 100) / 100
}

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

// .5-linje (ingen "push") sat ud fra en rate pr. kamp (data-drevet fra VM).
const halfLine = (matchCount: number, perMatch: number) => Math.floor(matchCount * perMatch) + 0.5
// Markederne er ENSIDEDE: kun den positive forudsigelse (Over/Ja) kan spilles —
// "Under N mål" / "Nej til dominans" giver ikke mening som selvstændigt bet.
// resolve returnerer stadig over/under (hhv. yes/no), så et 'over'-bet taber
// korrekt når det lander under linjen. Odds er konsensus-baserede (sættes ved lås).
const OU = (line: number): BlockBetSide[] => [
  { value: 'over', label: `Over ${line}` },
]
const ouResolve = (line: (n: number) => number, actual: (s: BlockBetStats) => number) =>
  (s: BlockBetStats): string | null => (s.matchCount === 0 ? null : (actual(s) > line(s.matchCount) ? 'over' : 'under'))

// "Dominans"-markeder: mindst 60% af blokkens kampe samme resultat-type.
const domThreshold = (n: number) => Math.ceil(n * 0.6)
const yesOnly = (): BlockBetSide[] => [
  { value: 'yes', label: 'Ja' },
]
const domMarket = (
  key: string, label: string, noun: string, actual: (s: BlockBetStats) => number,
): BlockBetMarket => ({
  key, label,
  sides: () => yesOnly(),
  actual,
  resolve: (s) => (s.matchCount === 0 ? null : (actual(s) >= domThreshold(s.matchCount) ? 'yes' : 'no')),
  describe: (n) => `Mindst 60% (${domThreshold(n)} af ${n}) ${noun} i blokken?`,
})

// Målfest-tærskel (min. 2 kampe m. 5+ mål for en 8-kamps blok; skalerer).
const bigGameLine = (n: number) => Math.max(1, Math.round(n * 0.2))

export const BLOCK_BET_MARKETS: BlockBetMarket[] = [
  {
    key: 'goals_ou',
    label: 'Mål i blokken',
    line: (n) => halfLine(n, 2.85),
    sides: (n) => OU(halfLine(n, 2.85)),
    actual: (s) => s.totalGoals,
    resolve: ouResolve((n) => halfLine(n, 2.85), (s) => s.totalGoals),
    describe: (n) => `Går blokkens ${n} kampe over ${halfLine(n, 2.85)} mål i alt? (≈${(halfLine(n, 2.85) / n).toFixed(1)} mål/kamp)`,
  },
  domMarket('home_dom', 'Hjemme-dominans', 'hjemmesejre', (s) => s.homeWins),
  domMarket('draw_dom', 'Uafgjort-dominans', 'uafgjorte', (s) => s.draws),
  domMarket('away_dom', 'Ude-dominans', 'udesejre', (s) => s.awayWins),
  {
    key: 'clean_sheets_ou',
    label: 'Clean sheets',
    line: (n) => halfLine(n, 0.42),
    sides: (n) => OU(halfLine(n, 0.42)),
    actual: (s) => s.cleanSheets,
    resolve: ouResolve((n) => halfLine(n, 0.42), (s) => s.cleanSheets),
    describe: (n) => `Over ${halfLine(n, 0.42)} clean sheets (hold der holdt buret rent) i blokken?`,
  },
  {
    key: 'big_game',
    label: 'Målfest',
    sides: () => yesOnly(),
    actual: (s) => s.bigGames,
    resolve: (s) => (s.matchCount === 0 ? null : (s.bigGames >= bigGameLine(s.matchCount) ? 'yes' : 'no')),
    describe: (n) => `Mindst ${bigGameLine(n)} kampe i blokken med 5+ mål?`,
  },
]

export function getBlockBetMarket(key: string): BlockBetMarket | undefined {
  return BLOCK_BET_MARKETS.find((m) => m.key === key)
}
