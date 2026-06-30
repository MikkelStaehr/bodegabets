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

  while (offset <= MAX_OFFSET) {
    const res = await fetch(`${RANKINGS_BASE}&offset=${offset}`, { headers: HEADERS, cache: 'no-store' })
    if (!res.ok) break
    const $ = cheerio.load(await res.text())

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
 * Hent friske rankings for de givne ryttere og sæt uci_ranking + category.
 * Ryttere der ikke findes i ranking-indekset sættes til kategori 5 (uden for
 * top-listen). uci_ranking overskrives kun når en frisk værdi findes.
 */
export async function categorizeRiders(riderIds: string[]): Promise<{ total: number; ranked: number; updated: number }> {
  if (!riderIds.length) return { total: 0, ranked: 0, updated: 0 }

  const { data: riders } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, pcs_slug')
    .in('id', riderIds)

  const withSlug = (riders ?? []).filter((r) => !!r.pcs_slug) as { id: string; pcs_slug: string }[]
  const targetSlugs = new Set(withSlug.map((r) => r.pcs_slug))
  if (targetSlugs.size === 0) return { total: 0, ranked: 0, updated: 0 }

  const index = await scrapeRankingsIndex(targetSlugs)

  let ranked = 0
  let updated = 0
  const nowIso = new Date().toISOString()
  for (const r of withSlug) {
    const rank = index.get(r.pcs_slug) ?? null
    const category = rankingToCategory(rank)
    const patch: Record<string, unknown> = { category, updated_at: nowIso }
    if (rank != null) {
      patch.uci_ranking = rank
      ranked++
    }
    const { error } = await supabaseAdmin.from('cycling_riders').update(patch).eq('id', r.id)
    if (!error) updated++
  }

  return { total: withSlug.length, ranked, updated }
}
