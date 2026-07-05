/**
 * Central fetch for ALLE ProCyclingStats-kald.
 *
 * PCS er bag Cloudflare (403 "Just a moment") fra både vores hjemme-IP og
 * Railways datacenter-IP siden ~29/6 2026 — det rammer startliste-, resultat-,
 * rangliste- og rytter-scraping. For at komme udenom ruter vi kaldene gennem
 * én af to CF-løsere, i prioriteret rækkefølge:
 *
 *   1. FLARESOLVERR_URL — selvhostet FlareSolverr (headless browser der løser
 *      CF-challenge). GRATIS, ubegrænset volumen. Foretrukket når sat.
 *   2. SCRAPER_API_KEY  — ScraperAPI (betalt pr. credit). Fallback.
 *   3. Ingen af delene   — direkte fetch (lokal/ublokeret brug, no-op i test).
 *
 * Skifter man mellem løserne er det KUN env-variabler der ændres — ingen
 * kode-ændring, ingen ændring af crons/scraping-frekvens.
 */

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL
const SCRAPER_KEY = process.env.SCRAPER_API_KEY
const SCRAPER_EXTRA = process.env.SCRAPER_API_EXTRA ?? ''

/** Fald-tilbage-headers ved direkte (ikke-proxied) fetch. */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

/** True hvis PCS-kald ruter gennem en CF-løser (FlareSolverr eller ScraperAPI). */
export function pcsProxied(): boolean {
  return !!FLARESOLVERR_URL || !!SCRAPER_KEY
}

/**
 * Hent en PCS-URL via selvhostet FlareSolverr. FlareSolverr kører en rigtig
 * headless browser der løser CF's JavaScript-challenge og returnerer den
 * færdige HTML som JSON. Vi pakker den ind i et Response-objekt så callere
 * bruger den præcis som en almindelig fetch (res.ok / res.status / res.text()).
 */
async function flaresolverrFetch(url: string): Promise<Response> {
  const endpoint = `${FLARESOLVERR_URL!.replace(/\/$/, '')}/v1`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: 60000 }),
  })
  if (!res.ok) {
    // FlareSolverr selv fejlede (5xx/timeout) — giv en 502 videre så caller-
    // retries slår til i stedet for at tro at PCS gav tom HTML.
    return new Response('', { status: 502 })
  }
  const data = (await res.json()) as {
    status?: string
    solution?: { status?: number; response?: string }
  }
  const sol = data?.solution
  const html = sol?.response ?? ''
  const status = sol?.status ?? (data?.status === 'ok' ? 200 : 502)
  return new Response(html, { status })
}

/**
 * Hent en PCS-URL. Ruter gennem FlareSolverr (hvis sat), ellers ScraperAPI
 * (hvis sat), ellers direkte. `init` (fx caller-headers) bruges kun ved direkte
 * fetch — CF-løserne sætter selv realistiske headers/UA.
 */
export async function pcsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (FLARESOLVERR_URL) {
    return flaresolverrFetch(url)
  }
  if (SCRAPER_KEY) {
    const proxied =
      `https://api.scraperapi.com/?api_key=${encodeURIComponent(SCRAPER_KEY)}` +
      `&url=${encodeURIComponent(url)}&country_code=eu${SCRAPER_EXTRA}`
    return fetch(proxied, { cache: 'no-store' })
  }
  return fetch(url, { headers: DEFAULT_HEADERS, ...init })
}
