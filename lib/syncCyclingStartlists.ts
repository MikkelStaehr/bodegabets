/**
 * syncCyclingStartlists — TS-port af sync_startlists fra scripts/cycling/sync_results.py
 *
 * Scraper PCS-startlister for upcoming/active races og upserter til
 * cycling_startlists. Replace-all semantik: alle entries for et race
 * slettes før insert, så ophobning af forsvundne ryttere undgås.
 *
 * Bruges af admin-knappen i AdminCyclingDashboardTab. Cron'en kører det IKKE
 * automatisk — startlister er ikke kritiske for daglig drift, og PCS ændrer
 * dem ikke jævnt nok til at det betaler sig.
 */

import { supabaseAdmin } from '@/lib/supabase'
import * as cheerio from 'cheerio'

const PCS_BASE = 'https://www.procyclingstats.com'
const REQUEST_DELAY_MS = 1000
const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

async function pcsGet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) {
      console.warn(`[syncCyclingStartlists] HTTP ${res.status} for ${url}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.warn(`[syncCyclingStartlists] Network error for ${url}: ${err}`)
    return null
  }
}

type StartlistEntry = {
  pcs_slug: string
  name: string
  bib_number: number | null
}

type ParseResult = {
  entries: StartlistEntry[]
  /** Autoritativt count fra PCS' "X riders"-tekst i HTML, hvis fundet. */
  expectedCount: number | null
}

/**
 * Scrape en enkelt races startliste fra PCS.
 * URL: /race/{slug}/{year}/startlist
 *
 * Men-elite rosters ligger i <ul class="startlist_v4">, hvor HVERT TOPNIVEAU-
 * <li> repræsenterer ét hold. Hold-li'en indeholder en intern <ul> med ryttere.
 *
 * Vigtigt: PCS' HTML beholder begge entries når en rytter erstattes i et hold
 * (fx Pogacar → Oliveira på bib 4 hos UAE). Browser-UI'et viser kun den første
 * pr. bib, men HTML har dem begge. Derfor dedupere vi per (team-li, bib_number)
 * og beholder den FØRSTE — det matcher hvad PCS reelt viser i deres UI.
 *
 * Dedup på pcs_slug på tværs af hele dokumentet er IKKE nok: bib-nummeret er
 * det reelle "slot" og to ryttere med samme bib indenfor et hold er en
 * forældet entry der ikke er ryddet af PCS.
 *
 * Som ekstra validering parser vi PCS' "X riders"-tekst (renderet i en lille
 * <div.right.fs11>) og inkluderer det i resultatet til validering opstrøms.
 */
function parseStartlist(html: string): ParseResult {
  const $ = cheerio.load(html)

  // Autoritativt count fra "X riders"-tekst, hvis vi kan finde det.
  let expectedCount: number | null = null
  const countMatch = $('body').text().match(/(\d+)\s+riders/i)
  if (countMatch) {
    const n = parseInt(countMatch[1], 10)
    if (!Number.isNaN(n)) expectedCount = n
  }

  const teamLis = $('ul.startlist_v4 > li')
  if (teamLis.length === 0) {
    return { entries: parseFlat($), expectedCount }
  }

  const entries: StartlistEntry[] = []
  const seenSlugs = new Set<string>()

  teamLis.each((_, teamLi) => {
    // Dedupere per bib INDEN FOR holdet — behold første forekomst.
    const seenBibs = new Set<number>()
    $(teamLi).find('div.ridersCont > ul > li').each((_, li) => {
      const anchor = $(li).find('a[href^="rider/"]').first()
      const href = anchor.attr('href') ?? ''
      const slugMatch = href.match(/^rider\/([\w-]+)$/)
      if (!slugMatch) return
      const pcsSlug = slugMatch[1]

      const bibTxt = $(li).find('span.bib').first().text().trim()
      const bib = /^\d+$/.test(bibTxt) ? parseInt(bibTxt, 10) : null

      // Hvis vi allerede har set denne bib i holdet, er det en duplikeret
      // entry — den senere er typisk en udtrukket rytter PCS endnu ikke har
      // ryddet ud af HTML'en. Skip.
      if (bib !== null && seenBibs.has(bib)) return
      if (bib !== null) seenBibs.add(bib)

      // Cross-team dedup på slug: samme rytter kan ikke optræde på to hold.
      if (seenSlugs.has(pcsSlug)) return
      seenSlugs.add(pcsSlug)

      const name = anchor.text().trim().split(/\s+/).join(' ')
      if (!name) return

      entries.push({ pcs_slug: pcsSlug, name, bib_number: bib })
    })
  })

  return { entries, expectedCount }
}

/** Fallback når team-strukturen mangler — kun til legacy/uventede HTML. */
function parseFlat($: ReturnType<typeof cheerio.load>): StartlistEntry[] {
  const riderRe = /^rider\/([\w-]+)$/
  const seen = new Set<string>()
  const entries: StartlistEntry[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(riderRe)
    if (!m) return
    const pcsSlug = m[1]
    if (seen.has(pcsSlug)) return
    seen.add(pcsSlug)
    const name = $(el).text().trim().split(/\s+/).join(' ')
    if (!name) return
    const bibSpan = $(el).parent().find('span.bib').first()
    const bibTxt = bibSpan.text().trim()
    const bib = /^\d+$/.test(bibTxt) ? parseInt(bibTxt, 10) : null
    entries.push({ pcs_slug: pcsSlug, name, bib_number: bib })
  })
  return entries
}

export type SyncStartlistsResult = {
  ok: boolean
  racesProcessed: number
  entriesUpserted: number
  unmatched: number
  errors: string[]
}

/**
 * Synker startlister for alle upcoming/active races. Springer finished races
 * over (deres startliste ændrer sig ikke).
 */
export async function syncCyclingStartlists(year: number = new Date().getFullYear()): Promise<SyncStartlistsResult> {
  const result: SyncStartlistsResult = {
    ok: true,
    racesProcessed: 0,
    entriesUpserted: 0,
    unmatched: 0,
    errors: [],
  }

  // 1. Hent races der skal synkes
  const { data: races, error: raceErr } = await supabaseAdmin
    .from('cycling_races')
    .select('id, name, pcs_slug, status')
    .in('status', ['upcoming', 'active'])
    .order('start_date', { ascending: true })
  if (raceErr) {
    result.ok = false
    result.errors.push(`Fetch races: ${raceErr.message}`)
    return result
  }
  if (!races?.length) return result

  // 2. Hent rider-indeks (pcs_slug → id) til matching
  const { data: riders } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, pcs_slug')
  const riderBySlug = new Map<string, string>()
  for (const r of riders ?? []) {
    if (r.pcs_slug) riderBySlug.set(r.pcs_slug as string, r.id as string)
  }

  // 3. Pr. race: scrape + replace-all upsert
  for (const race of races) {
    try {
      const url = `${PCS_BASE}/race/${race.pcs_slug}/${year}/startlist`
      const html = await pcsGet(url)
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))
      if (!html) {
        result.errors.push(`${race.name}: ingen HTML`)
        continue
      }

      const { entries, expectedCount } = parseStartlist(html)
      if (entries.length === 0) {
        result.errors.push(`${race.name}: ingen ryttere parset`)
        continue
      }
      // Sanity check: PCS' egen "X riders"-tekst skal matche parsen. Hvis ikke,
      // har dedup'en (per-team-bib) ikke fanget alt — log advarsel, men gem
      // ikke fejlbehæftet data: drop overskydende entries fra enden af listen.
      if (expectedCount != null && entries.length !== expectedCount) {
        console.warn(
          `[syncCyclingStartlists] ${race.name}: parsed ${entries.length} ryttere, ` +
          `PCS angiver ${expectedCount}. ${entries.length > expectedCount ? 'Trimmer overskydende.' : 'Mangler ryttere — sjælden case, ignorerer.'}`,
        )
        if (entries.length > expectedCount) {
          entries.length = expectedCount
        }
      }

      // Match + byg rows
      const now = new Date().toISOString()
      const rows: { race_id: string; rider_id: string; bib_number: number | null; confirmed: boolean; updated_at: string }[] = []
      let unmatched = 0
      for (const e of entries) {
        const riderId = riderBySlug.get(e.pcs_slug)
        if (!riderId) { unmatched++; continue }
        rows.push({
          race_id: race.id as string,
          rider_id: riderId,
          bib_number: e.bib_number,
          confirmed: true,
          updated_at: now,
        })
      }
      result.unmatched += unmatched

      if (rows.length === 0) {
        result.errors.push(`${race.name}: 0 match (${unmatched} unmatched)`)
        continue
      }

      // Replace-all: slet eksisterende først
      await supabaseAdmin.from('cycling_startlists').delete().eq('race_id', race.id)
      const { error: insertErr } = await supabaseAdmin.from('cycling_startlists').insert(rows)
      if (insertErr) {
        result.errors.push(`${race.name}: insert failed — ${insertErr.message}`)
        continue
      }

      // Opdater startlist_total på racen
      await supabaseAdmin
        .from('cycling_races')
        .update({ startlist_total: entries.length })
        .eq('id', race.id)

      result.racesProcessed++
      result.entriesUpserted += rows.length
    } catch (err) {
      result.errors.push(`${race.name}: ${String(err)}`)
    }
  }

  if (result.errors.length > 0 && result.racesProcessed === 0) result.ok = false
  return result
}
