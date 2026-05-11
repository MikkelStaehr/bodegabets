/**
 * Shared data fetchers for landing-related pages (/ og /landing-v2).
 * Brug supabaseAdmin (service role) — kun for offentligt-aggregerede tal.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { LandingTickerItem, TickerPart } from '@/components/landing/LandingTicker'

const COPENHAGEN_TZ = 'Europe/Copenhagen'

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString('da-DK', {
    timeZone: COPENHAGEN_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('da-DK', {
    timeZone: COPENHAGEN_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Bygger ticker-items til landing-pages: næste 8 fodbold-kampe + næste 5
 * cykel-stages. Logos hentes inline (home/away for fodbold, race.logo_url
 * for cykling). Sammenflettet alternerende.
 */
export async function getLandingTickerItems(): Promise<{
  items: LandingTickerItem[]
  currentDate: string
}> {
  const footballItems: LandingTickerItem[] = []
  const cyclingItems: LandingTickerItem[] = []
  const nowIso = new Date().toISOString()

  // Fodbold — næste 8 kampe indenfor 14 dage
  try {
    const cutoff = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('kickoff, home_team_id, away_team_id')
      .gt('kickoff', nowIso)
      .lt('kickoff', cutoff)
      .order('kickoff', { ascending: true })
      .limit(8)

    const teamIds = new Set<number>()
    for (const m of matches ?? []) {
      teamIds.add(m.home_team_id)
      teamIds.add(m.away_team_id)
    }
    if (teamIds.size > 0) {
      const { data: teams } = await supabaseAdmin
        .from('teams')
        .select('id, name, logo_url')
        .in('id', [...teamIds])
      const teamById = new Map<number, { name: string; logo_url: string | null }>(
        (teams ?? []).map((t) => [
          t.id as number,
          { name: t.name as string, logo_url: t.logo_url as string | null },
        ]),
      )
      for (const m of matches ?? []) {
        const home = teamById.get(m.home_team_id)
        const away = teamById.get(m.away_team_id)
        const homeName = home?.name ?? '?'
        const awayName = away?.name ?? '?'
        const kickoff = formatKickoff(m.kickoff)
        // Logos flankerer dashen indvendigt:
        //   Liverpool [home-logo] – [away-logo] Chelsea · 17:30
        const parts: TickerPart[] = []
        parts.push({ type: 'text', text: `${homeName} ` })
        if (home?.logo_url) parts.push({ type: 'logo', url: home.logo_url })
        parts.push({ type: 'text', text: ` – ` })
        if (away?.logo_url) parts.push({ type: 'logo', url: away.logo_url })
        parts.push({ type: 'text', text: ` ${awayName} · ${kickoff}` })
        footballItems.push({
          parts,
          text: `${homeName} – ${awayName} · ${kickoff}`,
        })
      }
    }
  } catch {
    // Skipper fodbold hvis fetch fejler — ticker virker stadig med cykling alene
  }

  // Cykling — næste 5 stages
  try {
    const { data: stages } = await supabaseAdmin
      .from('cycling_stages')
      .select('stage_number, start_date, name, cycling_races(name, race_type, logo_url)')
      .gt('start_date', nowIso)
      .order('start_date', { ascending: true })
      .limit(5)

    type StageRow = {
      stage_number: number
      start_date: string
      name: string
      cycling_races: { name: string; race_type: string; logo_url: string | null } | null
    }
    for (const s of (stages ?? []) as unknown as StageRow[]) {
      const race = s.cycling_races
      if (!race) continue
      const date = formatDate(s.start_date)
      const textBody = race.race_type === 'one_day'
        ? `${race.name} · ${date}`
        : `${race.name} · Etape ${s.stage_number} · ${date}`
      const parts: TickerPart[] = []
      if (race.logo_url) parts.push({ type: 'logo', url: race.logo_url })
      parts.push({ type: 'text', text: `${race.logo_url ? ' ' : ''}${textBody}` })
      cyclingItems.push({ parts, text: textBody })
    }
  } catch {
    // Skipper cykling hvis fetch fejler
  }

  // Sammenflet alternerende
  const merged: LandingTickerItem[] = []
  const max = Math.max(footballItems.length, cyclingItems.length)
  for (let i = 0; i < max; i++) {
    if (i < footballItems.length) merged.push(footballItems[i])
    if (i < cyclingItems.length) merged.push(cyclingItems[i])
  }

  // Server-rendered datostreng (hydration-safe på cached pages)
  const currentDate = new Date().toLocaleDateString('da-DK', {
    timeZone: COPENHAGEN_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return { items: merged, currentDate }
}

/**
 * Tæller brugere med login indenfor de seneste 30 dage. Returnerer null
 * hvis kaldet fejler — landing-UI skjuler indikatoren ved null/<10.
 */
export async function getActiveUserCount(): Promise<number | null> {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const users = (data?.users ?? []) as Array<{ last_sign_in_at?: string | null }>
    if (users.length === 0) return null
    return users.filter((u) => {
      const last = u.last_sign_in_at
      return last ? new Date(last).getTime() > cutoff : false
    }).length
  } catch {
    return null
  }
}
