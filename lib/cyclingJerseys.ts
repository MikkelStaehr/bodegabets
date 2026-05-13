/**
 * Race-specifikke trøjefarver. Hvert Grand Tour har sine egne farver:
 *
 *   Giro:   Maglia Rosa (pink), Ciclamino (cyclamen), Blu (blå), Bianca (hvid)
 *   Tour:   Yellow (gul), Green (grøn), Polka (rød-på-hvid), White (hvid)
 *   Vuelta: Red (rød), Green (grøn), Polka (rød-på-hvid), White (hvid)
 *
 * For mindre løb falder vi tilbage til Tour-paletten (mest universelt
 * genkendelige farver i cykelsport).
 */

export type JerseyKey = 'leader' | 'points' | 'mountain' | 'youth'

export type JerseyStyle = {
  bg: string         // primær trøjefarve
  color: string      // tekst-farve (kontrast)
  stripe?: string    // valgfri kontrast-stribe (sponsor-band imitation)
}

const JERSEY_LABELS: Record<JerseyKey, string> = {
  leader: 'FØR',
  points: 'PT',
  mountain: 'BT',
  youth: 'UT',
}

const GIRO: Record<JerseyKey, JerseyStyle> = {
  leader:   { bg: '#EC4899', color: '#5C0E3A', stripe: '#FCE7F3' },  // Rosa
  points:   { bg: '#A21CAF', color: '#FCE7F3', stripe: '#F0ABFC' },  // Ciclamino
  mountain: { bg: '#2563EB', color: '#F0F9FF', stripe: '#BFDBFE' },  // Blu
  youth:    { bg: '#F8FAFC', color: '#475569', stripe: '#CBD5E1' },  // Bianca
}

const TOUR: Record<JerseyKey, JerseyStyle> = {
  leader:   { bg: '#FAC775', color: '#633806', stripe: '#FEF3C7' },  // Yellow
  points:   { bg: '#22C55E', color: '#0A2E14', stripe: '#BBF7D0' },  // Green
  mountain: { bg: '#FEE2E2', color: '#7F1D1D', stripe: '#DC2626' },  // Polka (red on white)
  youth:    { bg: '#F8FAFC', color: '#475569', stripe: '#CBD5E1' },  // White
}

const VUELTA: Record<JerseyKey, JerseyStyle> = {
  leader:   { bg: '#DC2626', color: '#FEE2E2', stripe: '#FCA5A5' },  // Red
  points:   { bg: '#22C55E', color: '#0A2E14', stripe: '#BBF7D0' },  // Green
  mountain: { bg: '#FEE2E2', color: '#7F1D1D', stripe: '#DC2626' },  // Polka
  youth:    { bg: '#F8FAFC', color: '#475569', stripe: '#CBD5E1' },  // White
}

export function getJerseyStyle(raceName: string | null | undefined, jersey: JerseyKey): JerseyStyle {
  const name = (raceName ?? '').toLowerCase()
  if (name.includes('giro')) return GIRO[jersey]
  if (name.includes('vuelta')) return VUELTA[jersey]
  // Default: Tour de France farver (mest universelt genkendt)
  return TOUR[jersey]
}

export function getJerseyLabel(jersey: JerseyKey): string {
  return JERSEY_LABELS[jersey]
}
