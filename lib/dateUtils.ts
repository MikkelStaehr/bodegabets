const TZ = 'Europe/Copenhagen'

/** Dato + tid: "lør. 5. apr. 21:00" — viser kun dato hvis midnight */
export function formatKickoff(iso: string): string {
  const d = new Date(iso)
  const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
  if (isMidnight) {
    return d.toLocaleDateString('da-DK', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
  }
  return d.toLocaleString('da-DK', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * "Kampdag"-nøgle med 12:00-grænse (Europe/Copenhagen): kampe der starter
 * mellem 00:00 og 11:59 hører til den FOREGÅENDE kampdag (natkampe ved VM i
 * USA). Returnerer YYYY-MM-DD for kampdagen. Brug til at gruppere kampe på
 * dage, så natkampe ikke smutter over i næste dag.
 */
function cphParts(iso: string): { y: number; m: number; d: number; h: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0')
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') }
}

export function matchdayKey(iso: string): string {
  const { y, m, d, h } = cphParts(iso)
  const base = Date.UTC(y, m - 1, d) - (h < 12 ? 86_400_000 : 0)
  const dt = new Date(base)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** "lørdag 13. juni" for kampdagen (12:00-grænse). */
export function matchdayLabel(iso: string): string {
  const dt = new Date(matchdayKey(iso) + 'T12:00:00Z')
  return dt.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** Kun tid: "21:00" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('da-DK', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

/** Dato med år: "5. apr. 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('da-DK', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Dato + tid (ingen ugedag): "5. apr. 21:00" */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('da-DK', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Dato + tid + sekunder: "5. apr. 21:00:45" */
export function formatTimeWithSeconds(iso: string): string {
  return new Date(iso).toLocaleString('da-DK', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
