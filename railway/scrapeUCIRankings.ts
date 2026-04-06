/**
 * scrapeUCIRankings.ts
 *
 * Scraper for UCI World Rankings fra ProCyclingStats.
 * Henter top 500 ryttere via direkte HTTP requests og upsert til
 * cycling_riders i Supabase.
 *
 * PCS ranking-side: https://www.procyclingstats.com/rankings/me/individual
 *
 * Navneformat: "EFTERNAVN Fornavn" → splittes til first_name/last_name.
 *
 * Category baseret på ranking:
 *   1–24 → 1, 25–49 → 2, 50–99 → 3, 100–199 → 4, 200+ → 5
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PCS_RANKING_URL = 'https://www.procyclingstats.com/rankings/me/individual'

const PCS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
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
 * Eksempler:
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

/**
 * Parser HTML fra PCS ranking-side og returnerer liste af ryttere.
 */
function parseRankingHTML(html: string): ParsedRider[] {
  const riders: ParsedRider[] = []

  // Find tbody content
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyMatch) {
    console.error('[scrapeUCIRankings] Kunne ikke finde <tbody> i HTML')
    return riders
  }

  const tbody = tbodyMatch[1]
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[1]

    // Hent alle <td> celler
    const cells: string[] = []
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].trim())
    }

    if (cells.length < 4) continue

    // Ranking (første celle med tal)
    const rankingStr = cells[0].replace(/<[^>]+>/g, '').trim()
    const ranking = parseInt(rankingStr)
    if (isNaN(ranking) || ranking <= 0) continue

    // Rider link og navn (celle med rider/ link)
    const riderCell = cells.find((c) => c.includes('rider/'))
    if (!riderCell) continue

    const slugMatch = riderCell.match(/href="(?:.*?)?rider\/([^"]+)"/)
    const nameMatch = riderCell.match(/>([^<]+)</)
    if (!slugMatch || !nameMatch) continue

    const pcs_slug = slugMatch[1]
    const rawName = nameMatch[1].trim()
    const { first_name, last_name } = parsePCSName(rawName)

    // Team (celle med team/ link)
    const teamCell = cells.find((c) => c.includes('team/'))
    const teamNameMatch = teamCell?.match(/>([^<]+)</)
    const team_name = teamNameMatch?.[1]?.trim() ?? ''

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

      if (!res.ok) return null

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

      const parsed = parseRankingHTML(html)
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

  // Upsert til cycling_riders
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
