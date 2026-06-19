/**
 * Sjov markering når en spiller scorer 0 point i en runde eller på en etape.
 *
 * Kælenavnet vælges stabilt pr. (user, kontekst) via en simpel hash, så
 * samme spiller ikke skifter klovne-titel mellem renderings — men forskellige
 * spillere får forskellige titler.
 *
 * Brug `shouldTaunt(score, allScores)` til at undgå at taunte alle når en
 * runde/etape bare ikke er scoret endnu (alle har 0 → ingen taunt).
 */

export const ZERO_POINT_TAUNTS: readonly string[] = [
  '🤡 Mr. Nullable',
  '🥯 Bagel-Bertel',
  '🍩 Donut-Daniel',
  '🦗 Crickets-Carl',
  '🪹 Tom-kurv-Tobias',
  '🥚 Nul-ægget',
  '💨 Vindstille-Viktor',
  '🎈 Luftballon-Lasse',
  '🫥 Hr. Spøgelse',
  '0️⃣ Greven af Nul',
  '🕳️ Hul-Henrik',
  '📉 Bunden-Bjarne',
  '🚽 WC-Walther',
  '🦆 Goose-Egg-Gert',
  '🪦 Sir Zero',
  '🌪️ Tomgangs-Tommy',
  '🎰 Nul-jackpot-Jens',
  '📭 Tom-postkasse',
  '🧊 Frost-Frederik',
  '🪙 Nul-mønt-Nikolaj',
] as const

function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Stabilt valg af kælenavn baseret på en seed (typisk `${userId}:${roundId}`
 * eller `${userId}:${stageId}`). Samme seed → samme taunt på tværs af
 * renderings.
 */
export function getTaunt(seed: string): string {
  const idx = djb2(seed) % ZERO_POINT_TAUNTS.length
  return ZERO_POINT_TAUNTS[idx]
}

/**
 * Som getTaunt, men springer navne i `taken` over (og tilføjer det valgte) —
 * så to spillere i SAMME visning aldrig får samme klovne-navn.
 */
export function getTauntUnique(seed: string, taken: Set<string>): string {
  const start = djb2(seed) % ZERO_POINT_TAUNTS.length
  for (let i = 0; i < ZERO_POINT_TAUNTS.length; i++) {
    const name = ZERO_POINT_TAUNTS[(start + i) % ZERO_POINT_TAUNTS.length]
    if (!taken.has(name)) { taken.add(name); return name }
  }
  return ZERO_POINT_TAUNTS[start]
}

/**
 * True hvis denne spillers score er 0 OG mindst én anden i samme kontekst
 * har scoret >0. Hvis alle har 0 (runden/etapen ikke scoret endnu) returneres
 * false — vi vil ikke taunte folk før der overhovedet er kommet point.
 */
export function shouldTaunt(score: number, allScores: number[]): boolean {
  if (score !== 0) return false
  return allScores.some((s) => s > 0)
}
