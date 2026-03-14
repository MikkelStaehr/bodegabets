/** Konverterer dansk lokaltid til UTC ISO-string */
export function danishTimeToUtc(dateStr: string, timeStr: string): string {
  if (!dateStr) return new Date(0).toISOString()
  const month = parseInt(dateStr.slice(5, 7), 10)
  const offsetHours = month >= 4 && month <= 9 ? 2 : 1
  const [hh, mm] =
    timeStr && timeStr !== '00:00' ? timeStr.split(':').map(Number) : [12, 0]
  const utcHour = hh - offsetHours
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (utcHour < 0) {
    d.setUTCDate(d.getUTCDate() - 1)
    d.setUTCHours(utcHour + 24, mm, 0, 0)
  } else {
    d.setUTCHours(utcHour, mm, 0, 0)
  }
  return d.toISOString()
}
