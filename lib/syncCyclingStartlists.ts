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

/**
 * Scrape en enkelt races startliste fra PCS.
 * URL: /race/{slug}/{year}/startlist
 * Men-elite rosters ligger i <ul class="startlist_v4">.
 */
function parseStartlist(html: string): StartlistEntry[] {
  const $ = cheerio.load(html)
  const root = $('ul.startlist_v4').length > 0
    ? $('ul.startlist_v4 a[href]')
    : $('a[href]')

  const riderRe = /^rider\/([\w-]+)$/
  const entries: StartlistEntry[] = []
  const seen = new Set<string>()

  root.each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(riderRe)
    if (!m) return
    const pcsSlug = m[1]
    if (seen.has(pcsSlug)) return

    const name = $(el).text().trim().split(/\s+/).join(' ')
    if (!name) return
    seen.add(pcsSlug)

    // Bib-nummer: text-node lige før <a> i samme parent (fx "1POGAČAR Tadej")
    const prev = (el as { prev?: { type: string; data?: string } }).prev
    let bib: number | null = null
    if (prev && prev.type === 'text' && typeof prev.data === 'string') {
      const txt = prev.data.trim()
      if (/^\d+$/.test(txt)) bib = parseInt(txt, 10)
    }

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

      const entries = parseStartlist(html)
      if (entries.length === 0) {
        result.errors.push(`${race.name}: ingen ryttere parset`)
        continue
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
