import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

const BOLD_CDN = 'https://bold.dk/img/tag/64x64'
const BOLD_TOURNAMENT_API = 'https://api.bold.dk/aggregator/v1/apps/page/tournament'

type BoldTeam = {
  id: number
  name: string
  image_name?: string | null
}

type BoldTournamentResponse = {
  tournament?: {
    id: number
    name: string
    image_name?: string | null
  }
  teams?: BoldTeam[]
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  // Hent alle leagues med bold_slug
  const { data: leagues, error: leaguesErr } = await supabaseAdmin
    .from('leagues')
    .select('id, name, bold_slug')
    .not('bold_slug', 'is', null)

  if (leaguesErr) {
    return NextResponse.json({ error: leaguesErr.message }, { status: 500 })
  }

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ error: 'Ingen leagues med bold_slug fundet' }, { status: 404 })
  }

  let tournamentsUpdated = 0
  let teamsUpdated = 0
  const results: Array<{ tournament: string; slug: string; teams_count: number; error?: string }> = []

  for (const league of leagues) {
    const slug = league.bold_slug as string

    try {
      const res = await fetch(`${BOLD_TOURNAMENT_API}?slug=${encodeURIComponent(slug)}`, {
        headers: {
          Referer: 'https://www.bold.dk/',
          Accept: 'application/json',
        },
        cache: 'no-store',
      })

      if (!res.ok) {
        results.push({ tournament: league.name, slug, teams_count: 0, error: `HTTP ${res.status}` })
        continue
      }

      const data: BoldTournamentResponse = await res.json()

      // Opdater turnering/league logo
      if (data.tournament?.image_name) {
        const logoUrl = `${BOLD_CDN}/${data.tournament.image_name}`
        const { error } = await supabaseAdmin
          .from('leagues')
          .update({ logo_url: logoUrl })
          .eq('id', league.id)

        if (!error) tournamentsUpdated++
      }

      // Opdater team logos
      let teamCount = 0
      const teams = data.teams ?? []

      for (const team of teams) {
        if (!team.image_name || !team.id) continue

        const logoUrl = `${BOLD_CDN}/${team.image_name}`

        // Opdater teams hvor bold_id matcher
        const { data: updated, error } = await supabaseAdmin
          .from('teams')
          .update({ logo_url: logoUrl })
          .eq('bold_id', team.id)
          .select('id')

        if (!error && updated && updated.length > 0) {
          teamCount += updated.length
        }
      }

      teamsUpdated += teamCount
      results.push({ tournament: league.name, slug, teams_count: teamCount })
    } catch (err) {
      results.push({
        tournament: league.name,
        slug,
        teams_count: 0,
        error: err instanceof Error ? err.message : 'Ukendt fejl',
      })
    }
  }

  return NextResponse.json({
    tournaments_updated: tournamentsUpdated,
    teams_updated: teamsUpdated,
    results,
  })
}
