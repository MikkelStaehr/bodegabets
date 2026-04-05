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
