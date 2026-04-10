// Shared cycling utility functions

const DANISH_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export function formatCyclingDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}. ${DANISH_MONTHS[d.getMonth()]}`
}

export function formatCyclingDeadline(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()}. ${DANISH_MONTHS[d.getMonth()]} kl. ${h}:${m}`
}

export const SHORT_RACE_NAMES: Record<string, string> = {
  'Paris-Roubaix': 'Roubaix',
  'Amstel Gold Race': 'Amstel',
  'La Flèche Wallonne': 'Flèche',
  'Liège-Bastogne-Liège': 'Liège',
  'Ronde van Vlaanderen': 'Flandern',
  'Milano-Sanremo': 'Sanremo',
  'Omloop Het Nieuwsblad': 'Omloop',
  'Dwars door Vlaanderen': 'Dwars',
  'Itzulia Basque Country': 'Itzulia',
  'Critérium du Dauphiné': 'Dauphiné',
  'Volta a Catalunya': 'Catalunya',
  'Tour de Romandie': 'Romandie',
  'Tour de Suisse': 'Suisse',
  'Eschborn-Frankfurt': 'Frankfurt',
  'GP Québec': 'Québec',
  'GP Montréal': 'Montréal',
  'Tour de France': 'Tour',
  "Giro d'Italia": 'Giro',
  'Vuelta a España': 'Vuelta',
}

export function shortRaceName(name: string): string {
  return SHORT_RACE_NAMES[name] ?? name
}

export function shortBlockName(name: string): string {
  const weekMatch = name.match(/^(.+?)\s*—\s*Uge\s*(\d+)/i)
  if (weekMatch) {
    const base = weekMatch[1]
      .replace(/d'Italia/i, '').replace(/de France/i, '').replace(/a España/i, '')
      .trim()
    return `${base} Uge ${weekMatch[2]}`
  }
  return name.replace(/-?klassikerne$/i, '').trim()
}

export const PROFILE_LABELS: Record<string, string> = {
  cobbled: 'Brosten', mountain: 'Bjerg', hilly: 'Kuperet',
  flat: 'Flad', itt: 'Enkeltstart', mixed: 'Blandet',
}

export const PROFILE_ICONS: Record<string, string> = {
  mountain: '⛰', hilly: '〜', cobbled: '⊞', flat: '—', itt: '⏱',
}

export const RACE_TYPE_LABELS: Record<string, string> = {
  one_day: 'Endagsløb', stage_race: 'Etapeløb',
}

export const CAT_LABELS: Record<number, string> = { 1: 'Kat 1', 2: 'Kat 2', 3: 'Kat 3', 4: 'Kat 4', 5: 'Kat 5' }

export const CAT_COLORS: Record<number, string> = {
  1: '#B8963E', 2: '#6B8F71', 3: '#4A6FA5', 4: '#8B6F47', 5: '#7A7060',
}
