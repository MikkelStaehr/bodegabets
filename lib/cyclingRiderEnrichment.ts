/**
 * Berig en cycling_riders-row med data fra PCS' rider-page. Bruges til at
 * udfylde photo_url (og evt. team_logo_url) på ryttere der er auto-insertet
 * via startlist-sync uden komplet data.
 *
 * PCS rider-side struktur (typisk):
 *   <img src="images/riders/xx/yy/{slug}-{year}.jpg"> — første rider-photo
 *   <a href="team/{slug}-{year}">{team_name}</a>     — current team-link
 *
 * Idempotent: hvis ingen photo findes returneres null så vi ikke overskriver
 * med tom værdi. Network/parse-fejl logges som warning og returnerer null.
 */

import * as cheerio from 'cheerio'

const PCS_BASE = 'https://www.procyclingstats.com'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

export type RiderEnrichment = {
  photo_url: string | null
  team_logo_url: string | null
  /** Aktuel team-tekst fra PCS rider-page (".page-title" indeholder
   *  "Navn»Team Name"). Bruges til at detektere hold-skift. */
  team_name: string | null
}

export async function enrichRiderFromPcs(pcsSlug: string): Promise<RiderEnrichment | null> {
  const url = `${PCS_BASE}/rider/${pcsSlug}`
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) {
      console.warn(`[enrichRider] ${pcsSlug}: HTTP ${res.status}`)
      return null
    }
    const html = await res.text()
    const $ = cheerio.load(html)

    // Rider-photo: første <img> hvor src indeholder "images/riders/"
    let photo: string | null = null
    const photoImg = $('img[src*="images/riders/"]').first()
    const photoSrc = photoImg.attr('src')
    if (photoSrc) {
      photo = photoSrc.startsWith('http') ? photoSrc : `${PCS_BASE}/${photoSrc}`
    }

    // Team-logo: find første shirt/logo-img (samme mønster som team-side bruger)
    let teamLogo: string | null = null
    const shirtImg = $('img[src*="images/shirts/"]').first()
    const shirtSrc = shirtImg.attr('src')
    if (shirtSrc) {
      teamLogo = shirtSrc.startsWith('http') ? shirtSrc : `${PCS_BASE}/${shirtSrc}`
    }

    // Team-navn: ".page-title" format er "Lennart Jasch»Tudor Pro Cycling Team".
    // Split på » og tag højre side. Fallback til første team-link hvis ikke fundet.
    let teamName: string | null = null
    const pageTitle = $('.page-title').first().text().trim()
    if (pageTitle.includes('»')) {
      teamName = pageTitle.split('»')[1]?.trim() || null
    }
    if (!teamName) {
      const teamLink = $('a[href^="team/"]').first().text().trim()
      if (teamLink) teamName = teamLink
    }

    if (!photo && !teamLogo && !teamName) return null
    return { photo_url: photo, team_logo_url: teamLogo, team_name: teamName }
  } catch (err) {
    console.warn(`[enrichRider] ${pcsSlug}: ${String(err)}`)
    return null
  }
}
