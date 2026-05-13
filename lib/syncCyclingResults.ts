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
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

async function pcsGet(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
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

// ─── Time parsing ──────────────────────────────────────────────────────────

export function parseTimeToSeconds(text: string | undefined | null): number | null {
  if (!text) return null
  let s = text.trim().replace(/^\+/, '').trim()
  if (!s || s === ',,' || s === '-') return null

  // H:MM:SS
  let m = s.match(/^(\d+):(\d{1,2}):(\d{2})$/)
  if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10)

  // M:SS
  m = s.match(/^(\d+):(\d{2})$/)
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)

  // Xh YY' ZZ"
  m = s.match(/^(\d+)h\s*(\d+)['’]\s*(\d+)/)
  if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10)

  // Bare seconds
  m = s.match(/^(\d+)["s]?$/)
  if (m) return parseInt(m[1], 10)

  return null
}

// ─── HTML parsing ──────────────────────────────────────────────────────────

export function parseResultsTable(html: string): ParsedRow[] {
  const $ = cheerio.load(html)
  const results: ParsedRow[] = []
  const seen = new Set<string>()

  $('a').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const m = href.match(/^rider\/([\w-]+)$/)
    if (!m) return
    const slug = m[1]
    if (seen.has(slug)) return

    // Skip links der IKKE er i en <tr> (favourites/widgets — Giro stage 3
    // edge case 2026-05-10 hvor en favourite-rytter slap igennem)
    const $row = $(el).closest('tr')
    if ($row.length === 0) return

    const name = $(el).text().trim()
    if (!name) return

    seen.add(slug)

    const cells = $row.find('td').toArray()
    let position: number | null = results.length + 1
    let dnf = false
    let abandonType: string | null = null
    let timeGapSeconds: number | null = null
    let team = ''

    if (cells.length > 0) {
      const posText = $(cells[0]).text().trim().toLowerCase()
      if (['dnf', 'dns', 'otl', 'dsq'].includes(posText)) {
        dnf = true
        abandonType = posText.toUpperCase()
        position = null
      } else {
        const posNum = posText.replace(/[^0-9]/g, '')
        if (/^\d+$/.test(posNum)) position = parseInt(posNum, 10)
      }

      // Team link
      const teamLink = $row.find('a[href^="team/"]').first()
      if (teamLink.length > 0) team = teamLink.text().trim()

      // Time gap fra sidste td
      if (cells.length >= 4) {
        const lastTd = $(cells[cells.length - 1])
        // Brug kun direkte text, ikke alle descendants
        const raw = lastTd.contents().filter(function () { return this.type === 'text' }).text().trim()
          || lastTd.text().trim()
        timeGapSeconds = parseTimeToSeconds(raw)
      }
    }

    results.push({
      pcs_slug: slug,
      name,
      position,
      time_gap_seconds: timeGapSeconds,
      dnf,
      abandon_type: abandonType,
    })
    void team
  })

  // Sanity: <10 entries uden time-gap → sandsynligvis startlist/favourites
  // (Giro stage 3 fanget her — 1 favourite slap gennem tr-filteret)
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

// ─── Classification scraper (dedikerede subsider) ──────────────────────────

type ClassificationSet = {
  gc: Record<string, number>      // pcs_slug → GC-placering
  points: Record<string, number>  // pcs_slug → points-placering
  mountain: Record<string, number>// pcs_slug → bjerg-placering
  youth: Record<string, number>   // pcs_slug → ung-placering
}

// PCS' classification-subsider er tab-baseret UI: alle 4 URLs returnerer
// præcis samme HTML med 12 <table>-elementer. JavaScript skifter blot hvilken
// tab der er aktiv. For at parse korrekt henter vi siden ÉN gang og plukker
// riders fra specifikke table-indekser.
//
// Verificeret mod Giro d'Italia 2026 stage 4 (commit 03006fd diagnostik):
//   Table 0 (177): stage result (Narvaez vandt stage 4 → han er #1 her,
//                   inkl. 3 DNFs listed sidst → 177 vs 174)
//   Table 1 (174): GC (Maglia Rosa — Ciccone leading)
//   Table 5 (15):  points classification (Maglia Ciclamino)
//   Table 6 (21):  mountain classification (Maglia Blu)
//   Table 8 (48):  youth classification (Maglia Bianca)
//
// Hvis PCS' template ændres eller andre Grand Tours bruger anden struktur,
// kan vi addressere ved enten at finde tables via class-selector eller
// scanne header-tekst ved hver table. For nu er hardcoding pragmatisk.
const CLASSIFICATION_TABLE_INDEX: Record<keyof ClassificationSet, number> = {
  gc: 1,
  points: 5,
  mountain: 6,
  youth: 8,
}

/**
 * Hent classifications (GC, points, mountain, youth) for en stage via PCS'
 * stage-N-gc subside (én HTTP-request — alle classifications ligger på samme
 * HTML, blot i forskellige <table>'er).
 *
 * Hvis subsiden ikke findes endnu (PCS publicerer dem først efter stage er
 * færdig) eller fejler, returneres tomme maps for alle klassifikationer.
 */
async function scrapeClassifications(slug: string, stageNum: number): Promise<ClassificationSet> {
  const base = stageNum === 0
    ? `${PCS_BASE}/race/${slug}/2026/prologue`
    : `${PCS_BASE}/race/${slug}/2026/stage-${stageNum}`

  const out: ClassificationSet = { gc: {}, points: {}, mountain: {}, youth: {} }

  const html = await pcsGet(`${base}-gc`)
  if (!html) return out

  const $ = cheerio.load(html)
  const tables = $('table').toArray()

  for (const [key, idx] of Object.entries(CLASSIFICATION_TABLE_INDEX) as Array<[keyof ClassificationSet, number]>) {
    const table = tables[idx]
    if (!table) continue

    const seen = new Set<string>()
    $(table).find('tr').each((_, tr) => {
      const $tr = $(tr)
      const cells = $tr.find('td').toArray()
      if (cells.length === 0) return  // header-row

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
        out[key][ridSlug] = posNum
      }
    })
  }

  console.log(`[scrapeClassifications] gc=${Object.keys(out.gc).length} pts=${Object.keys(out.points).length} mtn=${Object.keys(out.mountain).length} youth=${Object.keys(out.youth).length}`)
  return out
}

/**
 * Map en rytters bedste trøje fra classifications. Top-1 i hver kategori
 * bærer den respektive trøje. Hvis en rytter er #1 i flere (ofte Tadej i
 * Tour) vælges højeste prioritet: leader > points > mountain > youth.
 */
function jerseyForSlug(slug: string, c: ClassificationSet): string | null {
  if (c.gc[slug] === 1) return 'leader'
  if (c.points[slug] === 1) return 'points'
  if (c.mountain[slug] === 1) return 'mountain'
  if (c.youth[slug] === 1) return 'youth'
  return null
}

// ─── Public entry point ────────────────────────────────────────────────────

export async function syncCyclingResults(): Promise<{
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

  // 1) Aktive (eller netop finished) stage races med pcs_slug
  const { data: races, error: racesErr } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, pcs_slug, race_type, status')
    .in('status', ['active', 'finished'])
    .eq('race_type', 'stage_race')

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
  const cutoffDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
  const cutoffIso = cutoffDate.toISOString().slice(0, 10)
  const raceIds = races.map((r) => r.id)
  const { data: stages, error: stagesErr } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, race_id, stage_number, start_date')
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

    // Hent classifications (GC, points, mountain, youth) fra dedikerede
    // PCS-subsider. 4 ekstra HTTP-requests pr. stage med tighter delay.
    let classifications: ClassificationSet = { gc: {}, points: {}, mountain: {}, youth: {} }
    try {
      classifications = await scrapeClassifications(race.pcs_slug, stage.stage_number)
    } catch (err) {
      console.warn(`[syncCyclingResults] Classification scrape failed for ${race.name} stage ${stage.stage_number}: ${err}`)
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
    }> = []
    for (const r of parsed) {
      const riderId = riderIndex.get(r.pcs_slug)
      if (!riderId) {
        totalUnmatched++
        stageUnmatched++
        if (unmatchedSamples.length < 5) unmatchedSamples.push(r.pcs_slug)
        continue
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
        gc_position_after: classifications.gc[r.pcs_slug] ?? null,
        points_position_after: classifications.points[r.pcs_slug] ?? null,
        mountain_position_after: classifications.mountain[r.pcs_slug] ?? null,
        youth_position_after: classifications.youth[r.pcs_slug] ?? null,
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
        // Mark stage as uploaded
        await supabaseAdmin
          .from('cycling_stages')
          .update({ results_uploaded_at: new Date().toISOString() })
          .eq('id', stage.id)

        syncedStageIds.push(stage.id)
        totalUpserted += stageUpserted
        console.log(`[syncCyclingResults]   upserted ${stageUpserted}, unmatched in this stage tracked separately`)
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
