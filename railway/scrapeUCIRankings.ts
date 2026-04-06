/**
 * scrapeUCIRankings.ts
 *
 * Scraper for UCI World Rankings fra ProCyclingStats.
 * Henter top 500 ryttere via direkte HTTP requests og upsert til
 * cycling_riders i Supabase.
 *
 * PCS ranking-side: https://www.procyclingstats.com/rankings/me/individual
 * PCS navneformat: "EFTERNAVN Fornavn" → splittes til first_name/last_name.
 *
 * Category baseret på ranking:
 *   1–24 → 1, 25–49 → 2, 50–99 → 3, 100–199 → 4, 200+ → 5
 */

import { parse as parseHTML } from 'node-html-parser'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PCS_RANKING_URL = 'https://www.procyclingstats.com/rankings/me/individual'

const PCS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
} as const

const REQUEST_DELAY_MS = 1500

type ParsedRider = {
  pcs_slug: string
  first_name: string
  last_name: string
  team_name: string
  uci_ranking: number
  category: number
}

function rankingToCategory(ranking: number): number {
  if (ranking <= 24) return 1
  if (ranking <= 49) return 2
  if (ranking <= 99) return 3
  if (ranking <= 199) return 4
  return 5
}

/**
 * Splitter PCS navneformat "EFTERNAVN Fornavn" til { first_name, last_name }
 *   "POGAČAR Tadej" → { first_name: "Tadej", last_name: "Pogačar" }
 *   "VAN DER POEL Mathieu" → { first_name: "Mathieu", last_name: "Van Der Poel" }
 */
function parsePCSName(raw: string): { first_name: string; last_name: string } {
  const trimmed = raw.trim()
  const parts = trimmed.split(/\s+/)
  const lastNameParts: string[] = []
  let firstNameParts: string[] = []
  let foundFirst = false

  for (const part of parts) {
    if (!foundFirst && part === part.toUpperCase() && /[A-ZÀ-Ü]/.test(part)) {
      lastNameParts.push(part)
    } else {
      foundFirst = true
      firstNameParts.push(part)
    }
  }

  if (firstNameParts.length === 0 && lastNameParts.length > 1) {
    firstNameParts = [lastNameParts.pop()!]
  }

  const capitalizePart = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

  return {
    first_name: firstNameParts.join(' '),
    last_name: lastNameParts.map(capitalizePart).join(' '),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parser HTML fra én PCS ranking-side med node-html-parser.
 */
function parseRankingPage(html: string): ParsedRider[] {
  const root = parseHTML(html)
  const riders: ParsedRider[] = []

  const rows = root.querySelectorAll('table.basic tbody tr')
  if (rows.length === 0) {
    // Fallback: prøv uden .basic
    const fallbackRows = root.querySelectorAll('tbody tr')
    if (fallbackRows.length === 0) {
      console.warn('[scrapeUCIRankings] Ingen table rows fundet i HTML')
      return riders
    }
    rows.push(...fallbackRows)
  }

  for (const row of rows) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 4) continue

    // Ranking — første celle
    const rankingStr = cells[0].text.trim()
    const ranking = parseInt(rankingStr)
    if (isNaN(ranking) || ranking <= 0) continue

    // Rider link og navn
    const riderLink = row.querySelector('a[href*="rider/"]')
    if (!riderLink) continue

    const href = riderLink.getAttribute('href') ?? ''
    const slugMatch = href.match(/rider\/([^/]+)/)
    if (!slugMatch) continue

    const pcs_slug = slugMatch[1]
    const rawName = riderLink.text.trim()
    if (!rawName) continue

    const { first_name, last_name } = parsePCSName(rawName)

    // Team
    const teamLink = row.querySelector('a[href*="team/"]')
    const team_name = teamLink?.text.trim() ?? ''

    riders.push({
      pcs_slug,
      first_name,
      last_name,
      team_name,
      uci_ranking: ranking,
      category: rankingToCategory(ranking),
    })
  }

  return riders
}

/**
 * Fetcher én side fra PCS med retry-logik.
 */
async function fetchPage(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: PCS_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      })

      if (res.status >= 500 && attempt < retries) {
        console.warn(`[scrapeUCIRankings] HTTP ${res.status} for ${url} — retry ${attempt + 1}`)
        await sleep(3000)
        continue
      }

      if (!res.ok) {
        console.warn(`[scrapeUCIRankings] HTTP ${res.status} for ${url}`)
        return null
      }

      const html = await res.text()

      // Tjek for Cloudflare challenge
      if (html.includes('Just a moment...') || html.includes('challenge-platform')) {
        console.warn(`[scrapeUCIRankings] Cloudflare challenge på ${url}`)
        return null
      }

      return html
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[scrapeUCIRankings] Fetch fejl for ${url} — retry ${attempt + 1}: ${err}`)
        await sleep(3000)
        continue
      }
      throw err
    }
  }
  return null
}

/**
 * Scraper PCS UCI ranking og upsert til cycling_riders.
 * Henter op til 5 sider (100 per side, 500 ryttere total).
 */
export async function scrapeUCIRankings(): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = []
  const allRiders: ParsedRider[] = []

  const offsets = [0, 100, 200, 300, 400]

  for (const offset of offsets) {
    const url = offset === 0 ? PCS_RANKING_URL : `${PCS_RANKING_URL}/offset/${offset}`
    console.log(`[scrapeUCIRankings] Fetcher ${url}`)

    try {
      const html = await fetchPage(url)

      if (!html) {
        errors.push(`Ingen HTML for offset ${offset}`)
        break
      }

      const parsed = parseRankingPage(html)
      console.log(`[scrapeUCIRankings] Parsed ${parsed.length} ryttere fra offset ${offset}`)

      if (parsed.length === 0) break
      allRiders.push(...parsed)

      // Delay mellem requests
      if (offset < 400) await sleep(REQUEST_DELAY_MS)
    } catch (err) {
      errors.push(`Fetch fejl for offset ${offset}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (allRiders.length === 0) {
    console.log('[scrapeUCIRankings] Ingen ryttere fundet')
    return { upserted: 0, errors }
  }

  // Upsert til cycling_riders i chunks af 100
  const now = new Date().toISOString()
  const rows = allRiders.map((r) => ({
    pcs_slug: r.pcs_slug,
    first_name: r.first_name,
    last_name: r.last_name,
    team_name: r.team_name,
    uci_ranking: r.uci_ranking,
    category: r.category,
    updated_at: now,
  }))

  let upserted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabaseAdmin
      .from('cycling_riders')
      .upsert(chunk, { onConflict: 'pcs_slug' })

    if (error) {
      errors.push(`Upsert fejl (chunk ${i}–${i + chunk.length}): ${error.message}`)
    } else {
      upserted += chunk.length
    }
  }

  console.log(`[scrapeUCIRankings] Upserted ${upserted} ryttere, ${errors.length} fejl`)
  return { upserted, errors }
}
