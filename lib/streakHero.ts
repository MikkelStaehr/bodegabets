/**
 * Sjov markering når en spiller rammer mange kamp-resultater rigtigt i SAMME
 * runde (mindst 4 — typisk full house i en 4-kamps runde). Den positive
 * pendant til nul-runde-klovnen i `zeroPointTaunt.ts`: i stedet for et hånende
 * kælenavn får den skarpe runde et helte-øgenavn i leaderboardet.
 *
 * Navnet vælges stabilt pr. (user, kontekst) via en simpel hash, så samme
 * spiller ikke skifter helte-titel mellem renderings — men forskellige
 * spillere får forskellige titler. Markeringen er knyttet til den seneste
 * afgjorte runde, præcis som klovne-mærket, og nulstilles næste runde.
 */

/** Antal rigtige kamp-resultater i én runde der udløser helte-øgenavnet. */
export const STREAK_THRESHOLD = 4

export const STREAK_HEROES: readonly string[] = [
  '🎯 Skarpskytte-Søren',
  '🔮 Profeten',
  '🦈 Tipster-Hajen',
  '🎰 Jackpot-Jens',
  '🚀 Raket-Rasmus',
  '🧨 Bomben-Benny',
  '💎 Diamant-David',
  '🏹 Pilekast-Per',
  '🦅 Ørne-Erik',
  '⚡ Lynet-Lars',
  '🔥 Hot-hånd-Henrik',
  '🎲 Terning-Troels',
  '👑 Kupon-Kongen',
  '🧠 Geni-Gunnar',
  '🪄 Troldmand-Tobias',
  '🐉 Drage-Dennis',
  '⭐ Stjerne-Stefan',
  '🏆 Pokal-Poul',
  '💰 Money-Mads',
  '🎩 Hattetrick-Tom',
] as const

function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Stabilt valg af helte-øgenavn baseret på en seed (typisk
 * `${userId}:${roundId}` eller `${userId}:round`). Samme seed → samme helt
 * på tværs af renderings.
 */
export function getHero(seed: string): string {
  const idx = djb2(seed) % STREAK_HEROES.length
  return STREAK_HEROES[idx]
}

/**
 * Som getHero, men springer navne i `taken` over (og tilføjer det valgte) — så
 * to spillere i SAMME visning aldrig får samme helte-navn.
 */
export function getHeroUnique(seed: string, taken: Set<string>, offset = 0): string {
  const start = (djb2(seed) + offset) % STREAK_HEROES.length
  for (let i = 0; i < STREAK_HEROES.length; i++) {
    const name = STREAK_HEROES[(start + i) % STREAK_HEROES.length]
    if (!taken.has(name)) { taken.add(name); return name }
  }
  return STREAK_HEROES[start]
}
