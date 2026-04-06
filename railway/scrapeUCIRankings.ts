/**
 * scrapeUCIRankings.ts
 *
 * Scraper for UCI World Rankings fra ProCyclingStats via Puppeteer.
 * Henter top 500 ryttere og upsert til cycling_riders i Supabase.
 *
 * PCS ranking-side: https://www.procyclingstats.com/rankings/me/individual
 *
 * Navneformat: "EFTERNAVN Fornavn" → splittes til first_name/last_name.
 *
 * Category baseret på ranking:
 *   1–24 → 1, 25–49 → 2, 50–99 → 3, 100–199 → 4, 200+ → 5
 */

import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PCS_RANKING_URL = 'https://www.procyclingstats.com/rankings/me/individual'

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
 * Scraper én side fra PCS via Puppeteer og returnerer parsed ryttere.
 */
type Page = Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>>

async function scrapePage(page: Page, url: string): Promise<ParsedRider[]> {
  console.log(`[scrapeUCIRankings] Navigerer til ${url}`)
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })

  // Vent på at ranking-tabellen loader
  try {
    await page.waitForSelector('table.basic tbody tr', { timeout: 15_000 })
  } catch {
    console.warn(`[scrapeUCIRankings] Ingen tabel fundet på ${url}`)
    return []
  }

  // Ekstraher data fra DOM
  const riders = await page.evaluate(() => {
    const rows = document.querySelectorAll('table.basic tbody tr')
    const results: Array<{
      ranking: number
      pcs_slug: string
      name: string
      team_name: string
    }> = []

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td')
      if (cells.length < 4) return

      // Ranking — første celle
      const rankingText = cells[0]?.textContent?.trim() ?? ''
      const ranking = parseInt(rankingText)
      if (isNaN(ranking) || ranking <= 0) return

      // Rider link og navn
      const riderLink = row.querySelector('a[href*="rider/"]')
      if (!riderLink) return

      const href = riderLink.getAttribute('href') ?? ''
      const slugMatch = href.match(/rider\/(.+?)(?:$|\/)/)
      if (!slugMatch) return

      const pcs_slug = slugMatch[1]
      const name = riderLink.textContent?.trim() ?? ''

      // Team
      const teamLink = row.querySelector('a[href*="team/"]')
      const team_name = teamLink?.textContent?.trim() ?? ''

      results.push({ ranking, pcs_slug, name, team_name })
    })

    return results
  })

  return riders.map((r) => {
    const { first_name, last_name } = parsePCSName(r.name)
    return {
      pcs_slug: r.pcs_slug,
      first_name,
      last_name,
      team_name: r.team_name,
      uci_ranking: r.ranking,
      category: rankingToCategory(r.ranking),
    }
  })
}

/**
 * Scraper PCS UCI ranking via Puppeteer og upsert til cycling_riders.
 * Henter op til 5 sider (500 ryttere).
 */
export async function scrapeUCIRankings(): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = []
  const allRiders: ParsedRider[] = []

  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    // Hent op til 5 sider (100 ryttere per side)
    const offsets = [0, 100, 200, 300, 400]

    for (const offset of offsets) {
      const url = offset === 0 ? PCS_RANKING_URL : `${PCS_RANKING_URL}/offset/${offset}`

      try {
        const riders = await scrapePage(page, url)
        console.log(`[scrapeUCIRankings] Parsed ${riders.length} ryttere fra offset ${offset}`)

        if (riders.length === 0) break
        allRiders.push(...riders)
      } catch (err) {
        errors.push(`Scrape fejl for offset ${offset}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } finally {
    await browser.close()
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
