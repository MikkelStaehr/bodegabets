/**
 * Henter etape-start-tidspunkter fra PCS og opdaterer cycling_stages.start_time_utc.
 *
 * PCS' stage-side har "Start time: HH:MM" i lokal tid (race-stedets timezone).
 * Vi antager Europe/Paris for alle løb i den europæiske cykel-sæson (marts-
 * oktober) — det er præcist for ~99% af løb. For løb udenfor Europa (fx
 * Down Under) skal vi udvide senere; det er meget få stages der berøres.
 *
 * Synker kun stages der er upcoming (results_uploaded_at IS NULL og start_date
 * i fremtiden). Bevarer historiske stages som de er.
 */

import * as cheerio from 'cheerio'
import { supabaseAdmin } from '@/lib/supabase'

const PCS_BASE = 'https://www.procyclingstats.com'
const REQUEST_DELAY_MS = 1000
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
  Accept: 'text/html,application/xhtml+xml',
}

/**
 * Konvertér "YYYY-MM-DD" + "HH:MM" + europæisk lokal-tid til UTC ISO.
 *
 * Europe/Paris er CEST (UTC+2) fra slutningen af marts til slutningen af
 * oktober, og CET (UTC+1) resten af året. Vi bruger Intl.DateTimeFormat
 * til at finde den faktiske offset for datoen, så vi ikke skal hardcode
 * DST-grænserne.
 */
export function europeanLocalToUtcIso(dateStr: string, timeHHMM: string): string {
  const [hours, minutes] = timeHHMM.split(':').map((n) => parseInt(n, 10))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid time: ${timeHHMM}`)
  }

  // Strategi: byg en Date som UTC med de lokale tider, find hvad Paris ville
  // vise på det tidspunkt, og juster så den vises som ønsket.
  // Mere robust end at hardcode +1/+2 offset.
  const naiveUtc = new Date(`${dateStr}T${timeHHMM}:00Z`)
  const parisTimeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(naiveUtc)
  const [parisH, parisM] = parisTimeStr.split(':').map((n) => parseInt(n, 10))
  // Hvor mange minutter er Paris foran UTC for denne dato?
  let offsetMinutes = (parisH * 60 + parisM) - (hours * 60 + minutes)
  // Wrap-around hvis dag-grænse (sjælden case)
  if (offsetMinutes > 12 * 60) offsetMinutes -= 24 * 60
  if (offsetMinutes < -12 * 60) offsetMinutes += 24 * 60

  // Træk offset fra for at få UTC
  const utcMs = naiveUtc.getTime() - offsetMinutes * 60 * 1000
  return new Date(utcMs).toISOString()
}

export type StageClimb = {
  name: string
  length_km: number
  gradient_pct: number
  km_from_start?: number
  category?: number
}

/**
 * Henter både start-tid OG klatringer fra samme PCS stage-page (sparer HTTP).
 *
 * Klatringer: PCS lister hver klatring i body-text i formatet
 *   "Col de Chatain\n7.9 Km - 6.2%"
 * (med valgfri kategori og altitude før/efter). Vi bruger en regex over body
 * text der finder alle "<navn>\n... X.X km - X.X%" mønstre. Km-fra-start
 * er sværere at parse pålideligt da PCS embed det i deres profile-graphic;
 * vi prøver men accepterer at det kan mangle.
 */
async function fetchStagePageData(
  raceSlug: string, year: number, stageNumber: number,
): Promise<{ startTime: string | null; climbs: StageClimb[] }> {
  const stagePath = stageNumber === 0 ? 'prologue' : `stage-${stageNumber}`
  const url = `${PCS_BASE}/race/${raceSlug}/${year}/${stagePath}`
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return { startTime: null, climbs: [] }
    const html = await res.text()
    const $ = cheerio.load(html)
    const bodyText = $('body').text()

    // Start-tid
    let startTime: string | null = null
    const startMatch = bodyText.match(/Start time:\s*(\d{1,2}:\d{2})/i)
    if (startMatch) {
      const t = startMatch[1]
      startTime = t.length === 4 ? `0${t}` : t
    }

    // Klatringer — bruger to strategier sekventielt:
    // 1) Strukturet HTML: PCS embedder ofte profile-grafen som en .profile-elem
    //    med children pr. klatring. Vi prøver først den semantiske tilgang.
    // 2) Body-text regex fallback: matcher "<navn>X.X Km - X.X%"-mønstre.
    const climbs = extractClimbs($, bodyText)

    return { startTime, climbs }
  } catch {
    return { startTime: null, climbs: [] }
  }
}

function extractClimbs($: cheerio.CheerioAPI, bodyText: string): StageClimb[] {
  const climbs: StageClimb[] = []
  const seen = new Set<string>()

  // PCS lister klatringer i en sektion. Body-text format pr. klatring:
  //   "<altitude>m\n<name>\n<length> Km - <gradient>%"
  // Eller blot:
  //   "<name>\n<length> Km - <gradient>%"
  //
  // Regex'en fanger:
  //   group 1: navn (linje før length/gradient)
  //   group 2: length km
  //   group 3: gradient %
  //
  // Vi splitter body i linjer for at finde navnet på linjen FØR matchet —
  // det giver mere kontrol end multi-line regex på lange tekster.
  const lines = bodyText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  // Match "7.9 Km - 6.2%" og varianter (en-dash, minus, store/små bogstaver)
  const gradientLineRx = /^(\d+(?:\.\d+)?)\s*[Kk]m\s*[-–−]\s*(\d+(?:\.\d+)?)\s*%$/

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(gradientLineRx)
    if (!m) continue
    const lengthKm = parseFloat(m[1])
    const gradientPct = parseFloat(m[2])
    if (!Number.isFinite(lengthKm) || !Number.isFinite(gradientPct)) continue
    if (lengthKm < 0.3 || lengthKm > 50) continue // sanitet
    if (gradientPct < 1 || gradientPct > 20) continue

    // Navn = forrige line der ikke selv ligner et tal/altitude
    let name: string | null = null
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const prev = lines[j]
      if (!prev) continue
      if (/^\d+\s*m$/i.test(prev)) continue // "687m"
      if (/^\d/.test(prev)) continue // starter med tal — skip
      if (prev.length < 3 || prev.length > 60) continue
      if (prev.toLowerCase().includes('km') && prev.includes('%')) continue
      name = prev
      break
    }
    if (!name) continue

    // Dedup på navn + længde — undgår at samme klatring optræder flere gange
    // hvis PCS rendrer den i både hovedindhold og sidebar.
    const key = `${name.toLowerCase()}|${lengthKm}`
    if (seen.has(key)) continue
    seen.add(key)

    climbs.push({
      name,
      length_km: lengthKm,
      gradient_pct: gradientPct,
    })
  }

  return climbs
}

export type SyncStageTimesResult = {
  ok: boolean
  stagesScanned: number
  stagesUpdated: number
  errors: string[]
}

export async function syncCyclingStageTimes(): Promise<SyncStageTimesResult> {
  const result: SyncStageTimesResult = { ok: true, stagesScanned: 0, stagesUpdated: 0, errors: [] }

  // Hent upcoming stages: results endnu ikke uploadet OG start_date er i dag
  // eller fremtidigt. Inkluder dagens stages selvom de teknisk allerede er
  // "startet" — så lineup-deadline rettes selv hvis stage starter om en time.
  const today = new Date().toISOString().slice(0, 10)
  const { data: stages, error } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, stage_number, start_date, start_time_utc, cycling_races!inner(pcs_slug, status)')
    .is('results_uploaded_at', null)
    .gte('start_date', today)
    .in('cycling_races.status', ['upcoming', 'active'])
    .order('start_date', { ascending: true })
  if (error) {
    result.ok = false
    result.errors.push(`fetch stages: ${error.message}`)
    return result
  }
  if (!stages?.length) return result

  type StageRow = {
    id: string; stage_number: number; start_date: string; start_time_utc: string | null
    cycling_races: { pcs_slug: string; status: string } | { pcs_slug: string; status: string }[]
  }

  for (const stage of stages as unknown as StageRow[]) {
    result.stagesScanned++
    const race = Array.isArray(stage.cycling_races) ? stage.cycling_races[0] : stage.cycling_races
    const dateStr = stage.start_date.slice(0, 10)
    const year = parseInt(dateStr.slice(0, 4), 10)

    const { startTime: localTime, climbs } = await fetchStagePageData(race.pcs_slug, year, stage.stage_number)
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))

    const updates: Record<string, unknown> = {}

    // Start-tid
    if (localTime) {
      try {
        const startUtcIso = europeanLocalToUtcIso(dateStr, localTime)
        if (stage.start_time_utc !== startUtcIso) updates.start_time_utc = startUtcIso
      } catch (err) {
        result.errors.push(`stage ${stage.id}: convert ${err}`)
      }
    }

    // Klatringer — opdater altid hvis PCS gav os noget (kan ændres over tid
    // hvis ruten justeres tæt på løb-start)
    if (climbs.length > 0) updates.climbs = climbs

    if (Object.keys(updates).length === 0) continue

    const { error: updErr } = await supabaseAdmin
      .from('cycling_stages').update(updates).eq('id', stage.id)
    if (updErr) {
      result.errors.push(`stage ${stage.id}: ${updErr.message}`)
      continue
    }
    result.stagesUpdated++
    const parts: string[] = []
    if (updates.start_time_utc) parts.push(`${dateStr} ${localTime} CEST → ${updates.start_time_utc as string}`)
    if (updates.climbs) parts.push(`${climbs.length} klatringer`)
    console.log(`[syncStageTimes] ${race.pcs_slug} etape ${stage.stage_number}: ${parts.join(', ')}`)
  }

  return result
}
