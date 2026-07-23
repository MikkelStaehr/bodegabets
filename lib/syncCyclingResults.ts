/**
 * syncCyclingResults — TS-port af scripts/cycling/sync_results.py
 *
 * Henter etape-resultater fra procyclingstats.com for aktive stage-races og
 * upserter dem til cycling_results. Skipper fremtidige stages og stages der
 * allerede har results_uploaded_at sat.
 *
 * Kører fra Railway-cron (se railway/index.ts /sync-cycling-results endpoint).
 *
 * Begrænsninger ift. Python-scriptet (deferred til v2):
 * - Ingen stage profile/won_how update (ændrer sig sjældent efter løbet
 *   kører — stage-data forventes oprettet via sync_race_info først)
 * - Startlist sync forbliver i Python (ikke kritisk for daglig drift)
 */

import { supabaseAdmin } from '@/lib/supabase'
import { pcsFetch } from '@/lib/pcsFetch'
import * as cheerio from 'cheerio'

const PCS_BASE = 'https://www.procyclingstats.com'
const REQUEST_DELAY_MS = 1000
const MAX_RETRIES = 3
const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

type ParsedRow = {
  pcs_slug: string
  name: string
  position: number | null
  time_gap_seconds: number | null
  dnf: boolean
  abandon_type: string | null
  /** Km rytteren var i udbrud foran feltet (PCS svg_shield-ikon). 0 = ikke i udbrud. */
  km_in_break: number
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

async function pcsGet(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await pcsFetch(url, { headers: HEADERS })
      if (res.status === 404) return null
      if (!res.ok) {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 3000))
          continue
        }
        console.warn(`[syncCyclingResults] HTTP ${res.status} for ${url}`)
        return null
      }
      return await res.text()
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      console.warn(`[syncCyclingResults] Network error for ${url}: ${err}`)
      return null
    }
  }
  return null
}

// ─── HTML parsing ──────────────────────────────────────────────────────────

export function parseResultsTable(html: string): ParsedRow[] {
  const $ = cheerio.load(html)
  const results: ParsedRow[] = []
  const seen = new Set<string>()

  // Find resultat-tabellen: første <table> med "Time" i header og >5 rytter-rækker.
  // Filtrerer favourites/widgets fra (de har ikke Time-header).
  const tables = $('table').toArray()
  let resultTable: typeof tables[number] | null = null
  let timeColIdx = -1
  let rnkColIdx = 0

  for (const tbl of tables) {
    const $tbl = $(tbl)
    const headerCells = $tbl.find('thead th').toArray()
    if (headerCells.length === 0) continue
    const headerTexts = headerCells.map((th) => $(th).text().trim().toLowerCase())
    const timeIdx = headerTexts.findIndex((h) => h === 'time')
    if (timeIdx < 0) continue
    const rnkIdx = headerTexts.findIndex((h) => h === 'rnk' || h === '#' || h === 'pos')
    const riderRowCount = $tbl.find('tbody tr a[href^="rider/"]').length
    if (riderRowCount < 5) continue
    resultTable = tbl
    timeColIdx = timeIdx
    rnkColIdx = rnkIdx >= 0 ? rnkIdx : 0
    break
  }

  if (!resultTable) return []

  $(resultTable).find('tbody tr').each((_, tr) => {
    const $tr = $(tr)
    const cells = $tr.find('td').toArray()
    if (cells.length === 0) return

    const riderLink = $tr.find('a').filter((_i, a) => {
      const href = $(a).attr('href') ?? ''
      return /^rider\/[\w-]+$/.test(href)
    }).first()
    if (riderLink.length === 0) return

    const m = (riderLink.attr('href') ?? '').match(/^rider\/([\w-]+)$/)
    if (!m) return
    const slug = m[1]
    if (seen.has(slug)) return

    const name = riderLink.text().trim()
    if (!name) return

    seen.add(slug)

    let position: number | null = results.length + 1
    let dnf = false
    let abandonType: string | null = null
    let timeGapSeconds: number | null = null

    const posText = $(cells[rnkColIdx] ?? cells[0]).text().trim().toLowerCase()
    if (['dnf', 'dns', 'otl', 'dsq'].includes(posText)) {
      dnf = true
      abandonType = posText.toUpperCase()
      position = null
    } else {
      const posNum = posText.replace(/[^0-9]/g, '')
      if (/^\d+$/.test(posNum)) position = parseInt(posNum, 10)
    }

    if (timeColIdx >= 0 && timeColIdx < cells.length && position !== null) {
      const raw = $(cells[timeColIdx]).text().trim()
      timeGapSeconds = parseGapToSeconds(raw, position)
    }

    // Udbruds-km: PCS' røde svg_shield-ikon har title "N kilometre in a group
    // in front of the peloton". Ligger i samme række som rytteren.
    const breakTitle = $tr.find('div.svg_shield[title*="in front of the peloton"]').first().attr('title') ?? ''
    const kmMatch = breakTitle.match(/(\d+)\s*kilometre/i)
    const kmInBreak = kmMatch ? parseInt(kmMatch[1], 10) : 0

    results.push({
      pcs_slug: slug,
      name,
      position,
      time_gap_seconds: timeGapSeconds,
      dnf,
      abandon_type: abandonType,
      km_in_break: kmInBreak,
    })
  })

  // Sanity: <10 entries uden time-gap → sandsynligvis startlist/favourites
  if (results.length > 0 && results.length < 10) {
    const anyTime = results.some((r) => r.time_gap_seconds != null)
    if (!anyTime) return []
  }

  return results
}

// ─── Stage scraper ─────────────────────────────────────────────────────────

async function scrapeStageResults(slug: string, stageNum: number): Promise<ParsedRow[]> {
  const base = stageNum === 0
    ? `${PCS_BASE}/race/${slug}/2026/prologue`
    : `${PCS_BASE}/race/${slug}/2026/stage-${stageNum}`

  // Primær: /result subside med fuld liste
  const resultUrl = `${base}/result`
  const resultHtml = await pcsGet(resultUrl)
  let results = resultHtml ? parseResultsTable(resultHtml) : []

  // Fallback til stage-page hvis /result var tom
  if (results.length === 0) {
    const stageHtml = await pcsGet(base)
    if (stageHtml) results = parseResultsTable(stageHtml)
  }

  return results
}

/**
 * Scrape "Won how" fra stage-page. PCS rendrer det som "<li>Won how: 28.6 km solo</li>"
 * eller "Won how: Bunch sprint" osv. Bruges af scoring til Grimpeur won-how bonus
 * (Solo +50 +1/km, Sprint à deux +25, Small group +20) og Sprinter bonus
 * (Bunch sprint +20, Small group +25, Sprint à deux +50).
 */
/**
 * Scrape den officielle TTT-holdorden fra stage-siden.
 *
 * PCS viser den stage-specifikke holdtids-tabel (parent class "today") hvor
 * holdene er rangeret efter HOLDTID (1. plads = vinder af holdtempoet). Det
 * adskiller sig fra den individuelle klassement (hvor fx EF's Baudin var
 * hurtigst som enkeltperson selvom EF kun blev 3'er som hold).
 *
 * VIGTIGT: vi tager "today"-tabellen, IKKE den "general" teams-tabel (som er
 * det KUMULATIVE hold-klassement og giver en helt anden orden).
 *
 * Returnerer ordnet array af holdnavne, eller [] hvis ikke fundet.
 */
async function scrapeTttTeamOrder(slug: string, stageNum: number): Promise<string[]> {
  const base = stageNum === 0
    ? `${PCS_BASE}/race/${slug}/2026/prologue`
    : `${PCS_BASE}/race/${slug}/2026/stage-${stageNum}`
  const html = await pcsGet(base)
  if (!html) return []
  const $ = cheerio.load(html)

  // Find tabellen med hold-rækker (rank + team-link, ingen rytter-link) hvis
  // parent har class "today" (stage-specifik). Vælg den med flest hold-rækker.
  let best: { order: string[]; isToday: boolean } | null = null
  $('table').each((_, t) => {
    const parentClass = $(t).parent().attr('class') ?? ''
    const order: string[] = []
    $(t).find('tbody tr').each((__, tr) => {
      const cells = $(tr).find('td').toArray()
      if (!cells.length) return
      const rank = $(cells[0]).text().trim()
      const teamLink = $(tr).find('a[href^="team/"]').first()
      const hasRider = $(tr).find('a[href^="rider/"]').length > 0
      if (/^\d+$/.test(rank) && teamLink.length && !hasRider) {
        order.push(teamLink.text().trim())
      }
    })
    if (order.length < 5) return
    const isToday = /\btoday\b/.test(parentClass)
    // Foretræk "today"-tabellen (stage-resultat) over "general" (kumulativt)
    if (!best || (isToday && !best.isToday)) best = { order, isToday }
  })

  return best && (best as { order: string[]; isToday: boolean }).isToday
    ? (best as { order: string[]; isToday: boolean }).order
    : []
}

async function scrapeWonHow(slug: string, stageNum: number): Promise<string | null> {
  const base = stageNum === 0
    ? `${PCS_BASE}/race/${slug}/2026/prologue`
    : `${PCS_BASE}/race/${slug}/2026/stage-${stageNum}`
  const html = await pcsGet(base)
  if (!html) return null
  const $ = cheerio.load(html)
  const match = $('body').text().match(/Won how:\s*([^\n<]+?)(?:\s*(?:Avg|Profile|Vertical|$))/i)
  if (!match) return null
  return match[1].trim() || null
}

// ─── Classification scraper (dedikerede subsider) ──────────────────────────

type ClassificationEntry = {
  position: number
  rawValue: string | null  // sidste celle-tekst (point eller tid)
}

type ClassificationSet = {
  gc: Record<string, ClassificationEntry>      // GC: rawValue = tid-gap text
  points: Record<string, ClassificationEntry>  // points: rawValue = total points
  mountain: Record<string, ClassificationEntry>// mountain: rawValue = KOM points
  youth: Record<string, ClassificationEntry>   // youth: rawValue = tid-gap text
  /** Stage-specifikke sprint-points scoret af hver rytter på denne etape
   *  (sum af intermediate sprints + målspurt points). Fra "Today"-kolonnen
   *  i points classification-tabellen. */
  sprintPoints: Record<string, number>
  /** Stage-specifikke KOM-points på denne etape. Fra "Today"-kolonnen i
   *  mountain classification-tabellen. */
  mountainPoints: Record<string, number>
}

// Convenience accessor — returns position if present, else null
function posOf(entry: ClassificationEntry | undefined): number | null {
  return entry?.position ?? null
}

// PCS' stage-N-gc subside har main-tabs (STAGE, GC, POINTS, KOM, YOUTH, TEAMS).
// Hver tab har en "general" tabel (sammenlagt klassement) + valgfri "today hide"
// sub-tabeller (per-stage breakdowns som "Sprint at X", "KOM Sprint (2)" osv.).
//
// De tabeller hvis DIREKTE parent har class "general" er ALTID de 6 hoved-
// klassementer i fast rækkefølge — uanset hvor mange "today hide" sub-tabeller
// PCS indsætter (de varierer pr. stage-type: TT, bjergetape, fladetape):
//   general[0] = STAGE-resultat
//   general[1] = GC (Maglia Rosa)
//   general[2] = POINTS (Maglia Ciclamino)
//   general[3] = MOUNTAIN / KOM (Maglia Azzurra)
//   general[4] = YOUTH (Maglia Bianca)
//   general[5] = TEAMS
//
// Verificeret mod Giro 2026 stage 4 (12 tables) og stage 5 (13 tables) —
// "general"-filteret giver konsekvent de samme 6 hovedklassementer.
type ClassificationKey = 'gc' | 'points' | 'mountain' | 'youth'
// Værdi-kolonnen findes via header-tekst INDEN FOR den valgte tabel (Time/Pnt
// kan ligge i forskellige kolonne-indekser pga. UCI/Prev-kolonner mv.).
const VALUE_HEADER: Record<ClassificationKey, string> = {
  gc: 'time',
  points: 'pnt',
  mountain: 'pnt',
  youth: 'time',
}

/**
 * Hent alle 4 klassifikationer fra /stage-N-gc subsiden — én HTTP-request.
 * Filtrerer til "general"-tabeller (de sammenlagte klassementer) og indekserer
 * direkte. Robust mod PCS' varierende antal "today"-sub-tabeller.
 */
async function scrapeClassifications(slug: string, stageNum: number): Promise<ClassificationSet> {
  const base = stageNum === 0
    ? `${PCS_BASE}/race/${slug}/2026/prologue`
    : `${PCS_BASE}/race/${slug}/2026/stage-${stageNum}`

  const out: ClassificationSet = {
    gc: {}, points: {}, mountain: {}, youth: {},
    sprintPoints: {}, mountainPoints: {},
  }

  const html = await pcsGet(`${base}-gc`)
  if (!html) return out

  const $ = cheerio.load(html)

  // Filtrér til de "general"-tabeller (sammenlagte klassementer).
  //
  // PCS' antal og rækkefølge af general-tabeller VARIERER pr. etape-type:
  //   - Almindelig etape: [stage-resultat, GC, points, mountain, youth, teams] (6)
  //   - TTT: stage-resultat-tabellen mangler → [GC, points, mountain, youth, teams] (5)
  // Faste indekser brød derfor på TTT (GC blev læst som points → kun ~23
  // ryttere → stagen blev aldrig markeret færdig → ingen scoring).
  //
  // Robust løsning: identificér hvert klassement efter header-INDHOLD frem for
  // position. Points/bjerg har en "Pnt"-kolonne; GC/ungdom har "Time won/lost".
  // Hold-tabellen har ingen rytter-links og springes over. Rækkefølgen inden
  // for hver type er stabil: points før bjerg, og blandt time-tabellerne er
  // GC næstsidst og ungdom sidst (stage-resultatet, hvis til stede, er først).
  const allGeneral = $('table').toArray().filter((tbl) => $(tbl).parent().hasClass('general'))
  const pntTables: typeof allGeneral = []
  const timeTables: typeof allGeneral = []
  for (const tbl of allGeneral) {
    const hasRiderLinks = $(tbl).find('tbody tr a').toArray().some((a) => /^rider\/[\w-]+$/.test($(a).attr('href') ?? ''))
    if (!hasRiderLinks) continue // hold-tabellen o.l.
    const headerTxt = $(tbl).find('thead th').toArray().map((th) => $(th).text().trim().toLowerCase()).join('|')
    const hasPnt = headerTxt.includes('pnt')
    const hasTime = headerTxt.includes('time')
    // STAGE-RESULTAT-tabellen har BÅDE "Pnt" (UCI/etape-point) OG "Time"/"Timelag".
    // Den er ikke et klassement — tidligere blev den fanget af `includes('pnt')`
    // og lagt som points-klassement, hvorved alt forskød sig (points←stage-resultat,
    // bjerg←points, og KOM forsvandt helt → sprint_points altid 0).
    // Klassementerne: points/bjerg har Pnt (+Today) UDEN Time; GC/ungdom har Time UDEN Pnt.
    if (hasPnt && !hasTime) pntTables.push(tbl)
    else if (hasTime && !hasPnt) timeTables.push(tbl)
  }
  const tableFor: Record<ClassificationKey, (typeof allGeneral)[number] | undefined> = {
    points: pntTables[0],
    mountain: pntTables[1],
    gc: timeTables.length >= 2 ? timeTables[timeTables.length - 2] : timeTables[0],
    youth: timeTables[timeTables.length - 1],
  }
  if (!tableFor.gc) {
    console.warn(`[scrapeClassifications] ingen GC-tabel fundet (pnt=${pntTables.length} time=${timeTables.length}) — PCS-template ændret?`)
    return out
  }

  for (const key of ['gc', 'points', 'mountain', 'youth'] as const) {
    const table = tableFor[key]
    if (!table) {
      console.warn(`[scrapeClassifications] ${key}: tabel mangler (header-match)`)
      continue
    }

    // Find værdi-kolonne via header (Time/Pnt kan være i forskellige indekser)
    const headerCells = $(table).find('thead th').toArray()
    const valueColIdx = headerCells.findIndex((th) => $(th).text().trim().toLowerCase() === VALUE_HEADER[key])

    const seen = new Set<string>()
    $(table).find('tbody tr').each((_, tr) => {
      const $tr = $(tr)
      const cells = $tr.find('td').toArray()
      if (cells.length === 0) return

      const riderLink = $tr.find('a').filter((_i, a) => {
        const href = $(a).attr('href') ?? ''
        return /^rider\/[\w-]+$/.test(href)
      }).first()
      if (riderLink.length === 0) return

      const m = (riderLink.attr('href') ?? '').match(/^rider\/([\w-]+)$/)
      if (!m) return
      const ridSlug = m[1]
      if (seen.has(ridSlug)) return
      seen.add(ridSlug)

      const posText = $(cells[0]).text().trim()
      const posNum = parseInt(posText.replace(/[^0-9]/g, ''), 10)
      if (Number.isFinite(posNum) && posNum > 0) {
        const valCell = valueColIdx >= 0 && valueColIdx < cells.length
          ? cells[valueColIdx]
          : cells[cells.length - 1]
        const rawValue = valCell ? $(valCell).text().trim() : null
        out[key][ridSlug] = { position: posNum, rawValue: rawValue || null }

        // Stage-specifikke "Today"-points for points + mountain. Hvis tabellen
        // har en "Today"-kolonne efter "Pnt", indeholder den hvor mange points
        // rytteren scorede PÅ DENNE ETAPE (ikke sammenlagt).
        if (key === 'points' || key === 'mountain') {
          const todayColIdx = headerCells.findIndex((th) => $(th).text().trim().toLowerCase() === 'today')
          if (todayColIdx >= 0 && todayColIdx < cells.length) {
            const todayText = $(cells[todayColIdx]).text().trim()
            const todayNum = parseInt(todayText.replace(/[^0-9]/g, ''), 10)
            if (Number.isFinite(todayNum) && todayNum > 0) {
              const target = key === 'points' ? out.sprintPoints : out.mountainPoints
              target[ridSlug] = todayNum
            }
          }
        }
      }
    })
  }

  console.log(`[scrapeClassifications] gc=${Object.keys(out.gc).length} pts=${Object.keys(out.points).length} mtn=${Object.keys(out.mountain).length} youth=${Object.keys(out.youth).length} sprintPts=${Object.keys(out.sprintPoints).length} mountainPts=${Object.keys(out.mountainPoints).length}`)
  return out
}

/**
 * Map en rytters bedste trøje fra classifications. Top-1 i hver kategori
 * bærer den respektive trøje. Hvis en rytter er #1 i flere (ofte Tadej i
 * Tour) vælges højeste prioritet: leader > points > mountain > youth.
 */
function jerseyForSlug(slug: string, c: ClassificationSet): string | null {
  if (posOf(c.gc[slug]) === 1) return 'leader'
  if (posOf(c.points[slug]) === 1) return 'points'
  if (posOf(c.mountain[slug]) === 1) return 'mountain'
  if (posOf(c.youth[slug]) === 1) return 'youth'
  return null
}

/**
 * Parser tid-gap fra PCS' classification-celle. Cellen har to sub-rendering
 * (abs-tid + gap), som cheerio.text() konkatenerer:
 *   Leader:     "16:18:51 16:18:51"       → abs tid x2 → gap = 0
 *   Pos 2 GC:   ",,0:04"                  → tom + gap → 4 sek
 *   Pos 2 yth:  "0:020:02"                → gap x2 → 2 sek
 *
 * Heuristik: hvis position er 1 → gap = 0. Ellers find første tid-substring
 * (HH:MM:SS eller MM:SS), parse den.
 */
function parseGapToSeconds(raw: string | null | undefined, position: number): number | null {
  if (position === 1) return 0
  if (!raw) return null
  const cleaned = raw.replace(/[+,]/g, ' ').trim()
  if (!cleaned || cleaned === '-' || cleaned === '—') return null
  const m = cleaned.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const h = m[3] ? parseInt(m[1], 10) : 0
  const mins = m[3] ? parseInt(m[2], 10) : parseInt(m[1], 10)
  const secs = m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10)
  if ([h, mins, secs].some(isNaN)) return null
  return h * 3600 + mins * 60 + secs
}

/** Parser ren-tal point fra string, fx "115" eller "115 pts" */
function parsePointsValue(raw: string | null | undefined): number | null {
  if (!raw) return null
  const m = raw.match(/(\d+)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

// ─── Public entry point ────────────────────────────────────────────────────

/**
 * @param opts.backfillDays Udvider backoff-vinduet (default 3 dage) så ældre
 *   pending stages kan re-scrapes. Bruges KUN til manuelle engangs-backfills —
 *   den daglige cron kalder uden argument og beholder 3-dages-vinduet.
 */
export async function syncCyclingResults(opts: { backfillDays?: number } = {}): Promise<{
  ok: boolean
  stagesProcessed: number
  resultsUpserted: number
  unmatched: number
  syncedStageIds: string[]
  errors: string[]
}> {
  const errors: string[] = []
  let totalUpserted = 0
  let totalUnmatched = 0
  const syncedStageIds: string[] = []

  // 1) Alle stage races. Vi filtrerer på stage-niveau via start_date i stedet
  //    for race.status — race.status opdateres ikke automatisk fra upcoming
  //    til active, så filteret missede aktive races der stadig stod som
  //    upcoming. Stage-filteret (start_date <= today AND >= today - 3 dage)
  //    er den autoritative gate.
  const { data: races, error: racesErr } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, pcs_slug, race_type, status')
    .eq('race_type', 'stage_race')
    .neq('status', 'cancelled')

  if (racesErr) {
    errors.push(`Failed to fetch races: ${racesErr.message}`)
    return { ok: false, stagesProcessed: 0, resultsUpserted: 0, unmatched: 0, syncedStageIds: [], errors }
  }
  if (!races || races.length === 0) {
    return { ok: true, stagesProcessed: 0, resultsUpserted: 0, unmatched: 0, syncedStageIds: [], errors: [] }
  }

  // 2) Pending stages: results_uploaded_at IS NULL, start_date <= today,
  //    OG start_date >= today - 3 dage. Backoff-vindue: hvis vi ikke har
  //    fået results på 3 dage er PCS-data sandsynligvis korrupt eller
  //    rytter-matching ramt fejl (fx Tour de Romandie stage 6 der hænger
  //    fast efter HTTP 500 fra PCS). Stopper unyttig timely retry-loop.
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const backoffDays = opts.backfillDays ?? 3
  const cutoffDate = new Date(today.getTime() - backoffDays * 24 * 60 * 60 * 1000)
  const cutoffIso = cutoffDate.toISOString().slice(0, 10)
  const raceIds = races.map((r) => r.id)
  const { data: stages, error: stagesErr } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, race_id, stage_number, start_date, profile')
    .in('race_id', raceIds)
    .is('results_uploaded_at', null)
    .gte('start_date', `${cutoffIso}T00:00:00Z`)
    .lte('start_date', `${todayIso}T23:59:59Z`)
    .order('stage_number', { ascending: true })

  if (stagesErr) {
    errors.push(`Failed to fetch stages: ${stagesErr.message}`)
    return { ok: false, stagesProcessed: 0, resultsUpserted: 0, unmatched: 0, syncedStageIds: [], errors }
  }
  if (!stages || stages.length === 0) {
    return { ok: true, stagesProcessed: 0, resultsUpserted: 0, unmatched: 0, syncedStageIds: [], errors: [] }
  }

  // Højeste stage_number pr. race — bruges til at genkende SIDSTE etape. Den
  // afgør løbet/blokken, så den skal ikke hænge 24t på et brudt GC-klassement.
  const { data: allRaceStages } = await supabaseAdmin
    .from('cycling_stages').select('race_id, stage_number').in('race_id', raceIds)
  const maxStageByRace = new Map<string, number>()
  for (const s of (allRaceStages ?? []) as Array<{ race_id: string; stage_number: number }>) {
    if (s.stage_number > (maxStageByRace.get(s.race_id) ?? 0)) maxStageByRace.set(s.race_id, s.stage_number)
  }

  // 3) Build pcs_slug → rider_id index
  const { data: ridersData } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, pcs_slug')
  const riderIndex = new Map<string, string>()
  for (const r of (ridersData ?? []) as Array<{ id: string; pcs_slug: string | null }>) {
    if (r.pcs_slug) riderIndex.set(r.pcs_slug, r.id)
  }
  console.log(`[syncCyclingResults] Rider-index: ${riderIndex.size} ryttere`)

  // 4) Iterate pending stages
  const racesById = new Map<string, typeof races[number]>(races.map((r) => [r.id, r]))

  for (const stage of stages) {
    const race = racesById.get(stage.race_id)
    if (!race?.pcs_slug) continue

    console.log(`[syncCyclingResults] ${race.name} stage ${stage.stage_number}...`)

    let parsed: ParsedRow[] = []
    try {
      parsed = await scrapeStageResults(race.pcs_slug, stage.stage_number)
    } catch (err) {
      const msg = `Scrape failed (${race.name} stage ${stage.stage_number}): ${err}`
      console.warn(`[syncCyclingResults] ${msg}`)
      errors.push(msg)
      continue
    }

    if (parsed.length === 0) {
      console.log(`[syncCyclingResults]   ingen results — skipper`)
      // Vent stadig så vi ikke hammer'er PCS
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))
      continue
    }

    // Hent classifications (GC, points, mountain, youth) fra PCS' stage-N-gc
    // subside. PCS publicerer stage-resultatet ~15-30 min efter målgang, men
    // de fulde klassement-tabeller kan komme TIMER senere. Hvis vi rammer for
    // tidligt får vi tomme/delvise klassementer.
    let classifications: ClassificationSet = { gc: {}, points: {}, mountain: {}, youth: {}, sprintPoints: {}, mountainPoints: {} }
    try {
      classifications = await scrapeClassifications(race.pcs_slug, stage.stage_number)
    } catch (err) {
      console.warn(`[syncCyclingResults] Classification scrape failed for ${race.name} stage ${stage.stage_number}: ${err}`)
    }

    // Klassementerne ser komplette ud hvis GC har et fornuftigt antal ryttere.
    // Et Grand Tour-felt er 150-180 ryttere; <50 betyder PCS ikke har publiceret
    // de fulde tabeller endnu (eller template har skiftet). I så fald upserter vi
    // stadig stage-resultatet (det ER klar), men markerer IKKE stagen som færdig
    // — så den eksisterende hourly cron retry'er indtil klassementerne er klar.
    // Escape-hatch: hvis stagen er >24t gammel accepterer vi delvise data, så
    // en evig PCS-fejl ikke blokerer point-beregning permanent.
    const gcCount = Object.keys(classifications.gc).length
    const classificationsComplete = gcCount >= 50
    // Resultat-tabellen kan være DELVIS selvom GC-klassementet allerede er
    // publiceret: en bjergetape drypper i mål over 20-40 min. Kræv derfor at vi
    // har ~hele feltet før vi finaliserer — ellers låses delvise placeringer
    // (Tour 2026 etape 2 blev låst på 116/184 ryttere → både udbruds-km og
    // GC-snapshot ufuldstændige).
    //
    // VIGTIGT: feltet SKRUMPER gennem et Grand Tour (udgåede ryttere). En fast
    // 90%-af-STARTLISTEN-tærskel betød at uge-3-etaper (hvor >10% er udgået)
    // ALDRIG nåede "komplet" og altid hang til 24t-nødventilen → point ~1 døgn
    // forsinket i sidste uge (Tour 2026 etape 17: 164 finishers, 19 udgåede,
    // 164 < 90%×184 = 165 → hang). Mål derfor mod det NUVÆRENDE felt: GC-
    // klassementet (gcCount) tæller kun ryttere der stadig er i løbet. Fald
    // tilbage til startlisten hvis GC ikke er publiceret (fx endagsløb).
    const { count: startlistCount } = await supabaseAdmin
      .from('cycling_startlists')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', stage.race_id)
    const fieldBaseline = gcCount >= 50 ? gcCount : (startlistCount ?? 0)
    const resultsComplete = !fieldBaseline || parsed.length >= Math.floor(fieldBaseline * 0.9)
    const stageAgeMs = Date.now() - new Date(stage.start_date).getTime()
    const stageOlderThan24h = stageAgeMs > 24 * 60 * 60 * 1000
    // SIDSTE etape afgør løbet — vent kun en kort grace (3t) på det fulde GC-
    // klassement. Er PCS' GC-side brudt (som ved Dauphiné 2026), finaliserer vi
    // på placeringerne i stedet for at hænge i 24t.
    const isLastStage = stage.stage_number === maxStageByRace.get(stage.race_id)
    const lastStageGracePassed = isLastStage && stageAgeMs > 3 * 60 * 60 * 1000
    const shouldMarkUploaded = (classificationsComplete && resultsComplete) || stageOlderThan24h || lastStageGracePassed
    if (!classificationsComplete || !resultsComplete) {
      console.warn(
        `[syncCyclingResults]   ufuldstændig (gc=${gcCount}, resultater=${parsed.length}/${startlistCount ?? '?'}) — ` +
        (stageOlderThan24h
          ? 'stage >24t gammel, markerer alligevel som færdig'
          : 'markerer IKKE som færdig, retry næste cron')
      )
    }
    // Map til DB-rows
    let stageUpserted = 0
    let stageUnmatched = 0
    const unmatchedSamples: string[] = []
    const rows: Array<{
      race_id: string
      rider_id: string
      stage_number: number
      position: number | null
      time_gap_seconds: number | null
      dnf: boolean
      abandon_type: string | null
      jersey: string | null
      gc_position_after: number | null
      points_position_after: number | null
      mountain_position_after: number | null
      youth_position_after: number | null
      points_value: number | null
      mountain_value: number | null
      gc_gap_seconds: number | null
      youth_gap_seconds: number | null
      sprint_points: number
      mountain_points: number
      km_in_break: number
    }> = []
    for (const r of parsed) {
      const riderId = riderIndex.get(r.pcs_slug)
      if (!riderId) {
        totalUnmatched++
        stageUnmatched++
        if (unmatchedSamples.length < 5) unmatchedSamples.push(r.pcs_slug)
        continue
      }
      const slugClassifs = {
        gc: classifications.gc[r.pcs_slug],
        points: classifications.points[r.pcs_slug],
        mountain: classifications.mountain[r.pcs_slug],
        youth: classifications.youth[r.pcs_slug],
      }
      rows.push({
        race_id: stage.race_id,
        rider_id: riderId,
        stage_number: stage.stage_number,
        position: r.position,
        time_gap_seconds: r.time_gap_seconds,
        dnf: r.dnf,
        abandon_type: r.abandon_type,
        jersey: jerseyForSlug(r.pcs_slug, classifications),
        gc_position_after: posOf(slugClassifs.gc),
        points_position_after: posOf(slugClassifs.points),
        mountain_position_after: posOf(slugClassifs.mountain),
        youth_position_after: posOf(slugClassifs.youth),
        points_value: parsePointsValue(slugClassifs.points?.rawValue),
        mountain_value: parsePointsValue(slugClassifs.mountain?.rawValue),
        gc_gap_seconds: slugClassifs.gc
          ? parseGapToSeconds(slugClassifs.gc.rawValue, slugClassifs.gc.position)
          : null,
        youth_gap_seconds: slugClassifs.youth
          ? parseGapToSeconds(slugClassifs.youth.rawValue, slugClassifs.youth.position)
          : null,
        sprint_points: classifications.sprintPoints[r.pcs_slug] ?? 0,
        mountain_points: classifications.mountainPoints[r.pcs_slug] ?? 0,
        km_in_break: r.km_in_break,
      })
    }
    if (stageUnmatched > 0) {
      console.log(`[syncCyclingResults]   parsed=${parsed.length} matched=${rows.length} unmatched=${stageUnmatched} (sample: ${unmatchedSamples.join(', ')})`)
    }

    if (rows.length > 0) {
      // Batched upsert (200 ad gangen for at undgå payload-limit)
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200)
        const { error: upErr } = await supabaseAdmin
          .from('cycling_results')
          .upsert(batch, { onConflict: 'race_id,rider_id,stage_number' })
        if (upErr) {
          const msg = `Upsert (${race.name} stage ${stage.stage_number}): ${upErr.message}`
          console.error(`[syncCyclingResults] ${msg}`)
          errors.push(msg)
          continue
        }
        stageUpserted += batch.length
      }

      if (stageUpserted > 0) {
        totalUpserted += stageUpserted
        if (shouldMarkUploaded) {
          // Won-how (Solo / Bunch sprint / Sprint a deux / Small group) — bruges
          // af Grimpeur og Sprinter scoring til won-how bonus. Hentes inden vi
          // markerer stagen færdig så scoring kan tilgå den med det samme.
          let wonHow: string | null = null
          try {
            wonHow = await scrapeWonHow(race.pcs_slug, stage.stage_number)
            if (wonHow) console.log(`[syncCyclingResults]   won_how: "${wonHow}"`)
          } catch (err) {
            console.warn(`[syncCyclingResults]   won_how scrape failed: ${err}`)
          }

          // TTT: scrape den officielle holdorden (holdtid) — scoringen kan ikke
          // udlede den fra individuelle placeringer (de afspejler ikke holdtid).
          let tttOrder: string[] = []
          if ((stage as { profile?: string | null }).profile === 'ttt') {
            try {
              tttOrder = await scrapeTttTeamOrder(race.pcs_slug, stage.stage_number)
              if (tttOrder.length) console.log(`[syncCyclingResults]   TTT-holdorden: ${tttOrder.slice(0, 3).join(', ')}...`)
              else console.warn(`[syncCyclingResults]   TTT-holdorden ikke fundet`)
            } catch (err) {
              console.warn(`[syncCyclingResults]   TTT-team-order scrape failed: ${err}`)
            }
          }

          // Mark stage as uploaded — klassementer er komplette (eller stagen
          // er gammel nok til at vi accepterer delvise data)
          await supabaseAdmin
            .from('cycling_stages')
            .update({
              results_uploaded_at: new Date().toISOString(),
              ...(wonHow ? { won_how: wonHow } : {}),
              ...(tttOrder.length ? { ttt_team_order: tttOrder } : {}),
            })
            .eq('id', stage.id)

          syncedStageIds.push(stage.id)
          console.log(`[syncCyclingResults]   upserted ${stageUpserted}, stage markeret færdig`)
        } else {
          // Stage-resultat er upsertet men klassementerne mangler — lad stagen
          // forblive pending så næste cron retry'er klassement-scrapen.
          console.log(`[syncCyclingResults]   upserted ${stageUpserted}, stage forbliver pending (afventer klassementer)`)
        }
      }
    }

    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))
  }

  // 5) Log til admin_logs
  await supabaseAdmin.from('admin_logs').insert({
    type: 'cycling_results_sync',
    status: errors.length === 0 ? 'success' : 'error',
    message: `cycling_results_sync: stages=${stages.length}, upserted=${totalUpserted}, unmatched=${totalUnmatched}`,
    metadata: {
      stages_processed: stages.length,
      results_upserted: totalUpserted,
      unmatched: totalUnmatched,
      synced_stage_ids: syncedStageIds,
      errors: errors.length > 0 ? errors : undefined,
    },
  })

  return {
    ok: errors.length === 0,
    stagesProcessed: stages.length,
    resultsUpserted: totalUpserted,
    unmatched: totalUnmatched,
    syncedStageIds,
    errors,
  }
}
