/**
 * Beregn deadline for en cycling-etape (start - 30 min).
 *
 * Hvis stage har start_time_utc (faktisk PCS-tid) bruges den — det er det
 * autoritative svar. Ellers falder vi tilbage til en sensibel default på
 * 13:00 UTC (~15:00 CEST) baseret på start_date.
 *
 * startTimeUtc har FORRANG: hvis sat, bruges den uanset hvad start_date er.
 */
export function getStageDeadline(
  startDate: string | null | undefined,
  startTimeUtc?: string | null,
): Date | null {
  // Foretrukket: faktisk PCS-tid hvis sat
  if (startTimeUtc) {
    const t = new Date(startTimeUtc)
    if (!isNaN(t.getTime())) return new Date(t.getTime() - 30 * 60 * 1000)
  }
  return fallbackDeadlineFromDate(startDate)
}

function fallbackDeadlineFromDate(startDate: string | null | undefined): Date | null {
  if (!startDate) return null

  // Hvis det er en ren YYYY-MM-DD streng → tilføj default tid
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const start = new Date(`${startDate}T13:00:00Z`)
    return new Date(start.getTime() - 30 * 60 * 1000)
  }

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  // Timestamp med eksakt 00:00:00 UTC → PCS-data manglede tid → brug 13:00 UTC
  if (
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    start.getUTCSeconds() === 0
  ) {
    const adjusted = new Date(start)
    adjusted.setUTCHours(13, 0, 0, 0)
    return new Date(adjusted.getTime() - 30 * 60 * 1000)
  }

  return new Date(start.getTime() - 30 * 60 * 1000)
}

/** Helper: er deadline passeret? */
export function isStageDeadlinePassed(
  startDate: string | null | undefined,
  now: Date = new Date(),
  startTimeUtc?: string | null,
): boolean {
  const deadline = getStageDeadline(startDate, startTimeUtc)
  if (!deadline) return false
  return deadline < now
}

/**
 * Faktisk start-tidspunkt for en etape (ikke deadline). Bruges til at
 * afgøre om en etape er live. Foretrækker start_time_utc når sat.
 */
export function getStageStartTime(
  startDate: string | null | undefined,
  startTimeUtc?: string | null,
): Date | null {
  if (startTimeUtc) {
    const t = new Date(startTimeUtc)
    if (!isNaN(t.getTime())) return t
  }
  return fallbackStartFromDate(startDate)
}

function fallbackStartFromDate(startDate: string | null | undefined): Date | null {
  if (!startDate) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return new Date(`${startDate}T13:00:00Z`)
  }

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  if (
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    start.getUTCSeconds() === 0
  ) {
    const adjusted = new Date(start)
    adjusted.setUTCHours(13, 0, 0, 0)
    return adjusted
  }

  return start
}
