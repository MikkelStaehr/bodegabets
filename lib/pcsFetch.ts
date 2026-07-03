/**
 * Central fetch for ALLE ProCyclingStats-kald.
 *
 * PCS er bag Cloudflare (403 "Just a moment") fra både vores hjemme-IP og
 * Railways datacenter-IP siden ~29/6 2026 — det rammer startliste-, resultat-,
 * rangliste- og rytter-scraping. For at komme udenom ruter vi kaldene gennem
 * ScraperAPI (løser CF-challenge server-side) NÅR miljøvariablen SCRAPER_API_KEY
 * er sat. Uden nøgle falder vi tilbage til direkte fetch — så lokal/ublokeret
 * brug bevares og helperen er en no-op i test.
 *
 * Skulle CF stramme yderligere kan man eskalere UDEN en kode-ændring via
 * SCRAPER_API_EXTRA (fx "&premium=true" eller "&render=true") i Railway-env.
 */

const SCRAPER_KEY = process.env.SCRAPER_API_KEY
const SCRAPER_EXTRA = process.env.SCRAPER_API_EXTRA ?? ''

/** Fald-tilbage-headers ved direkte (ikke-proxied) fetch. */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

/** True hvis PCS-kald ruter gennem scrape-proxyen (nøgle sat). */
export function pcsProxied(): boolean {
  return !!SCRAPER_KEY
}

/**
 * Hent en PCS-URL. Ruter gennem ScraperAPI hvis SCRAPER_API_KEY er sat,
 * ellers direkte. `init` (fx caller-headers) bruges kun ved direkte fetch —
 * proxyen sætter selv realistiske headers/UA, så vi sender ikke vores egne.
 */
export async function pcsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (SCRAPER_KEY) {
    const proxied =
      `https://api.scraperapi.com/?api_key=${encodeURIComponent(SCRAPER_KEY)}` +
      `&url=${encodeURIComponent(url)}&country_code=eu${SCRAPER_EXTRA}`
    return fetch(proxied, { cache: 'no-store' })
  }
  return fetch(url, { headers: DEFAULT_HEADERS, ...init })
}
