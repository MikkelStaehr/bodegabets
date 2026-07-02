/**
 * Auto-kategorisering af cykelryttere ud fra UCI-ranking.
 *
 * Kategorien er en ren bucket af PCS' individuelle ranking (samme tærskler som
 * det oprindelige Python-seed, scripts/cycling/sync_all.py: ranking_to_category):
 *   ≤24 → 1,  ≤49 → 2,  ≤99 → 3,  ≤199 → 4,  ellers/ukendt → 5.
 *
 * Rankingen hentes fra PCS' ranking-index (rankings.php?p=me&s=individual),
 * pagineret med offset, og matches på rider.pcs_slug. Kør 48t før et løb (se
 * railway /categorize-cycling-riders) — ALDRIG under et løb, og kun for det
 * kommende løbs startliste, så kvinde-/ikke-deltagende ryttere ikke røres.
 */

import * as cheerio from 'cheerio'
import { supabaseAdmin } from '@/lib/supabase'

const PCS_BASE = 'https://www.procyclingstats.com'
const RANKINGS_BASE = `${PCS_BASE}/rankings.php?p=me&s=individual&filter=Filter`
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}
const REQUEST_DELAY_MS = 1200
const MAX_OFFSET = 4000 // sikkerhedsgrænse (~40 sider) så vi ikke looper i det uendelige

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** PCS individuel ranking → spil-kategori 1–5. Ukendt ranking → 5. */
export function rankingToCategory(ranking: number | null | undefined): number {
  if (ranking == null) return 5
  if (ranking <= 24) return 1
  if (ranking <= 49) return 2
  if (ranking <= 99) return 3
  if (ranking <= 199) return 4
  return 5
}

/**
 * Skrab PCS' ranking-index → Map<pcs_slug, ranking>. Stopper når alle
 * target-slugs er fundet, eller en side ikke giver nye ryttere (slut på listen).
 */
async function scrapeRankingsIndex(targetSlugs: Set<string>): Promise<Map<string, number>> {
  const index = new Map<string, number>()
  const riderRe = /^rider\/([\w-]+)$/
  let offset = 0

  // Hent én side med retries — PCS kan give en transient 403/tom side (fx fra
  // datacenter-IP). Uden retry ville ét fejlet fetch tømme hele indekset.
  const fetchPage = async (o: number): Promise<string | null> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(`${RANKINGS_BASE}&offset=${o}`, { headers: HEADERS, cache: 'no-store' })
        if (res.ok) {
          const html = await res.text()
          if (html.includes('rider/')) return html // rigtig ranking-side, ikke challenge/tom
        }
      } catch {
        // netværksfejl → prøv igen
      }
      await sleep(2000 * (attempt + 1))
    }
    return null
  }

  while (offset <= MAX_OFFSET) {
    const html = await fetchPage(offset)
    if (html == null) break
    const $ = cheerio.load(html)

    let pageCount = 0
    $('tr').each((_, tr) => {
      const href = $(tr).find('a[href^="rider/"]').first().attr('href')
      const m = href ? riderRe.exec(href) : null
      if (!m) return
      const slug = m[1]
      if (index.has(slug)) return
      const posText = $(tr).find('td').first().text().replace(/[^\d]/g, '')
      if (posText && /^\d+$/.test(posText)) {
        index.set(slug, parseInt(posText, 10))
        pageCount++
      }
    })

    if (pageCount === 0) break
    if ([...targetSlugs].every((s) => index.has(s))) break
    offset += 100
    await sleep(REQUEST_DELAY_MS)
  }

  return index
}

/**
 * Sæt category ud fra den BEDSTE tilgængelige ranking: frisk fra PCS hvis skrabet
 * lykkes, ELLERS rytterens eksisterende uci_ranking. Så et fejlet/CF-blokeret
 * skrab re-bucketer bare fra eksisterende data — det nulstiller ALDRIG til
 * kategori 5. uci_ranking overskrives kun når en frisk værdi findes.
 * `freshRanked` = antal med en NY ranking fra dette skrab (0 = skrab gav intet).
 */
export async function categorizeRiders(riderIds: string[]): Promise<{ total: number; freshRanked: number; updated: number }> {
  if (!riderIds.length) return { total: 0, freshRanked: 0, updated: 0 }

  const { data: riders } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, pcs_slug, uci_ranking')
    .in('id', riderIds)

  const withSlug = (riders ?? []).filter((r) => !!r.pcs_slug) as { id: string; pcs_slug: string; uci_ranking: number | null }[]
  const targetSlugs = new Set(withSlug.map((r) => r.pcs_slug))
  if (targetSlugs.size === 0) return { total: 0, freshRanked: 0, updated: 0 }

  const index = await scrapeRankingsIndex(targetSlugs)

  let freshRanked = 0
  let updated = 0
  const nowIso = new Date().toISOString()
  for (const r of withSlug) {
    const fresh = index.get(r.pcs_slug) ?? null
    // Frisk ranking hvis skrabet fandt den, ellers den eksisterende i DB'en.
    const rank = fresh ?? r.uci_ranking ?? null
    const category = rankingToCategory(rank)
    const patch: Record<string, unknown> = { category, updated_at: nowIso }
    if (fresh != null) {
      patch.uci_ranking = fresh
      freshRanked++
    }
    const { error } = await supabaseAdmin.from('cycling_riders').update(patch).eq('id', r.id)
    if (!error) updated++
  }

  return { total: withSlug.length, freshRanked, updated }
}
