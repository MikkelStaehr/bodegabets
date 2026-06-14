/**
 * Credit-budget for slutrunde-blokke (VM, credits_per_block).
 *
 * Standard: 1000 credits PR. BLOK, delt over blokkens runder (ingen
 * compounding). Enkelte blokke kan have et engangs-override — fx en
 * kompensation når en UX-fejl har snydt spillerne for en del af budgettet.
 *
 * Bruges både server-side (håndhævelse i submit-bets) og i kupon-loaderen, så
 * loft og visning altid er enige.
 */

export const DEFAULT_BLOCK_BUDGET = 1000

/**
 * Engangs-budget-override pr. blok (block_id → samlet budget for blokken).
 *
 * - Blok 11 (VM, runde 36177+36178): hævet til 2000. Runde 2's kupon åbnede
 *   først dagen efter runde 1, så spillere der brugte hele budgettet på dag 1
 *   stod uden credits til dag 2. Kompensation: +1000 til hele blokkens pulje.
 */
export const BLOCK_BUDGET_OVERRIDES: Readonly<Record<number, number>> = {
  11: 2000,
}

/** Samlet credit-budget for en blok (eller standard hvis intet override). */
export function blockBudgetFor(blockId: number | null | undefined): number {
  if (blockId != null && BLOCK_BUDGET_OVERRIDES[blockId] != null) {
    return BLOCK_BUDGET_OVERRIDES[blockId]
  }
  return DEFAULT_BLOCK_BUDGET
}
