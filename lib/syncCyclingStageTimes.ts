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

async function fetchStartTime(raceSlug: string, year: number, stageNumber: number): Promise<string | null> {
  // PCS stage URL: /race/{slug}/{year}/stage-{N}
  // Prolog håndteres som stage-0 i nogle løb, men brugen er konsistent.
  const stagePath = stageNumber === 0 ? 'prologue' : `stage-${stageNumber}`
  const url = `${PCS_BASE}/race/${raceSlug}/${year}/${stagePath}`
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return null
    const html = await res.text()
    const $ = cheerio.load(html)
    // PCS rendrer "Start time: HH:MM" i en <li> i info-blokken
    const match = $('body').text().match(/Start time:\s*(\d{1,2}:\d{2})/i)
    if (!match) return null
    const time = match[1]
    // Pad to "HH:MM" hvis kun "H:MM"
    return time.length === 4 ? `0${time}` : time
  } catch {
    return null
  }
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

    const localTime = await fetchStartTime(race.pcs_slug, year, stage.stage_number)
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))
    if (!localTime) continue

    let startUtcIso: string
    try {
      startUtcIso = europeanLocalToUtcIso(dateStr, localTime)
    } catch (err) {
      result.errors.push(`stage ${stage.id}: convert ${err}`)
      continue
    }

    // Skip update hvis allerede sat til samme værdi
    if (stage.start_time_utc === startUtcIso) continue

    const { error: updErr } = await supabaseAdmin
      .from('cycling_stages').update({ start_time_utc: startUtcIso }).eq('id', stage.id)
    if (updErr) {
      result.errors.push(`stage ${stage.id}: ${updErr.message}`)
      continue
    }
    result.stagesUpdated++
    console.log(`[syncStageTimes] ${race.pcs_slug} etape ${stage.stage_number}: ${dateStr} ${localTime} CEST → ${startUtcIso}`)
  }

  return result
}
