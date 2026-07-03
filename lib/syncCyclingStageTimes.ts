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
import { pcsFetch } from '@/lib/pcsFetch'

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
  category?: number
  km_from_start?: number
  length_km?: number
  gradient_pct?: number
}

/**
 * Henter både start-tid OG klatringer fra samme PCS stage-page (sparer HTTP).
 *
 * Klatringer scrapes med to strategier (verificeret mod Dauphiné 2026):
 *
 *  A) KOM-headers (afviklede etaper): PCS' resultattab indeholder <h4>'er som
 *     "KOM Sprint (2) Col de Chatain (22.8 km)" → giver navn + kategori +
 *     km-fra-start. Det er den bedste data (præcis position).
 *
 *  B) Climbs-liste (kommende etaper): under en "Climbs"-overskrift ligger en
 *     <ul class="list circle"> med klatrings-navne i rute-rækkefølge — men
 *     UDEN km, kategori eller gradient (de tal ligger kun i PCS' profil-
 *     billede fra FlammeRouge, som vi ikke kan parse). Vi får altså kun navne.
 *
 * Strategi A foretrækkes når den findes (rigere data); ellers falder vi
 * tilbage til B. Renderer'en håndterer begge: præcise spikes hvis km kendes,
 * ellers jævnt fordelte navne-markører.
 */
async function fetchStagePageData(
  raceSlug: string, year: number, stageNumber: number,
): Promise<{ startTime: string | null; climbs: StageClimb[]; profileImageUrl: string | null; isTTT: boolean }> {
  const stagePath = stageNumber === 0 ? 'prologue' : `stage-${stageNumber}`
  const url = `${PCS_BASE}/race/${raceSlug}/${year}/${stagePath}`
  try {
    const res = await pcsFetch(url, { headers: HEADERS })
    if (!res.ok) return { startTime: null, climbs: [], profileImageUrl: null, isTTT: false }
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

    // TTT-detektion: PCS' <title> er etape-specifik og indeholder "(TTT)" for
    // hold-tempo-etaper, fx "... Stage 3 (TTT) results". Vi bruger IKKE body-
    // text, da etape-navigationen nævner andre etapers (TTT) og giver false
    // positives. ITT (individuel tempo) detekteres ikke her — kun TTT.
    const isTTT = /\(TTT\)/i.test($('title').text())

    const climbs = extractClimbs($)
    const profileImageUrl = extractProfileImageUrl($)
    return { startTime, climbs, profileImageUrl, isTTT }
  } catch {
    return { startTime: null, climbs: [], profileImageUrl: null, isTTT: false }
  }
}

/**
 * Scrape PCS' rigtige profil-billede (FlammeRouge-genereret højdekurve).
 * PCS rendrer det som <img src="images/profiles/xx/yy/<race>-stage-N-profile.jpg">.
 * Vi hotlinker URL'en direkte (samme mønster som rytter-fotos), så vi behøver
 * ikke selv hoste billedet. Returnerer absolut URL eller null.
 */
function extractProfileImageUrl($: cheerio.CheerioAPI): string | null {
  let found: string | null = null
  $('img').each((_, el) => {
    if (found) return
    const src = $(el).attr('src') ?? $(el).attr('data-src')
    if (!src) return
    // PCS profil-billeder ligger under images/profiles/. Filnavn-suffixet
    // varierer (-profile.jpg på bjerg-etaper, -sprint.jpg på flade etaper),
    // så vi matcher kun på stien + billede-extension, ikke suffixet.
    if (/images\/profiles\/.+\.(jpg|jpeg|png)$/i.test(src)) {
      found = src.startsWith('http') ? src : `${PCS_BASE}/${src.replace(/^\/+/, '')}`
    }
  })
  return found
}

function extractClimbs($: cheerio.CheerioAPI): StageClimb[] {
  // ── Strategi A: KOM-headers med kategori + km-fra-start ──────────────────
  // <h4>KOM Sprint (2) Col de Chatain (22.8 km)</h4>
  const komClimbs: StageClimb[] = []
  const seenKom = new Set<string>()
  $('h4').each((_, el) => {
    const t = $(el).text().trim()
    const m = t.match(/\((\d)\)\s+(.+?)\s+\((\d+(?:\.\d+)?)\s*km\)/i)
    if (!m) return
    const category = parseInt(m[1], 10)
    const name = m[2].trim()
    const kmFromStart = parseFloat(m[3])
    if (!name || name.length > 60) return
    const key = name.toLowerCase()
    if (seenKom.has(key)) return
    seenKom.add(key)
    komClimbs.push({
      name,
      category: Number.isFinite(category) ? category : undefined,
      km_from_start: Number.isFinite(kmFromStart) ? kmFromStart : undefined,
    })
  })
  if (komClimbs.length > 0) {
    // Sortér efter km så rækkefølgen er korrekt
    komClimbs.sort((a, b) => (a.km_from_start ?? 0) - (b.km_from_start ?? 0))
    return komClimbs
  }

  // ── Strategi B: navne-liste under "Climbs"-overskrift ───────────────────
  // <h3>Climbs</h3><ul class="list circle"><li><div><a>...</a></div></li>...
  const nameClimbs: StageClimb[] = []
  const seenName = new Set<string>()
  $('h2, h3, h4').each((_, el) => {
    if ($(el).text().trim().toLowerCase() !== 'climbs') return
    const $ul = $(el).nextAll('ul').first()
    $ul.find('li').each((__, li) => {
      const name = $(li).text().trim()
      if (!name || name.length < 3 || name.length > 60) return
      const key = name.toLowerCase()
      if (seenName.has(key)) return
      seenName.add(key)
      nameClimbs.push({ name })
    })
  })
  return nameClimbs
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
    .select('id, stage_number, start_date, start_time_utc, profile_image_url, profile, cycling_races!inner(pcs_slug, status)')
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
    profile_image_url: string | null; profile: string | null
    cycling_races: { pcs_slug: string; status: string } | { pcs_slug: string; status: string }[]
  }

  for (const stage of stages as unknown as StageRow[]) {
    result.stagesScanned++
    const race = Array.isArray(stage.cycling_races) ? stage.cycling_races[0] : stage.cycling_races
    const dateStr = stage.start_date.slice(0, 10)
    const year = parseInt(dateStr.slice(0, 4), 10)

    const { startTime: localTime, climbs, profileImageUrl, isTTT } = await fetchStagePageData(race.pcs_slug, year, stage.stage_number)
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))

    const updates: Record<string, unknown> = {}

    // TTT-profil: hold-tempo-etaper scores efter holdresultat (egen logik i
    // calculateCyclingPoints). PCS giver dem terræn-profil 'hilly' o.l., men
    // vi overstyrer til 'ttt' så scoringen ved det er en holdetape.
    if (isTTT && stage.profile !== 'ttt') updates.profile = 'ttt'

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

    // Profil-billede — kun opdater hvis ændret (idempotent)
    if (profileImageUrl && profileImageUrl !== stage.profile_image_url) {
      updates.profile_image_url = profileImageUrl
    }

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
    if (updates.profile_image_url) parts.push('profil-billede')
    if (updates.profile) parts.push(`profil=${updates.profile as string}`)
    console.log(`[syncStageTimes] ${race.pcs_slug} etape ${stage.stage_number}: ${parts.join(', ')}`)
  }

  return result
}
