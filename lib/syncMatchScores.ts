import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOLD_MATCHES_API = 'https://api.bold.dk/aggregator/v1/apps/page/matches'

export async function syncMatchScores(): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = []
  let updated = 0

  // 1. Find kun kampe der KAN have scores lige nu
  // (kickoff indenfor de seneste 3 timer OG ikke allerede finished)
  const now = new Date()
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  const { data: activeMatches, error: fetchError } = await supabaseAdmin
    .from('league_matches')
    .select('id, bold_match_id, league_id, home_team, away_team, status')
    .neq('status', 'finished')
    .lte('kickoff_at', now.toISOString())
    .gte('kickoff_at', threeHoursAgo.toISOString())

  if (fetchError) {
    errors.push(`Fetch fejl: ${fetchError.message}`)
    return { updated, errors }
  }

  if (!activeMatches?.length) {
    console.log('[syncMatchScores] Ingen aktive kampe lige nu')
    return { updated, errors }
  }

  console.log(`[syncMatchScores] ${activeMatches.length} aktive kampe at tjekke`)

  // 2. Gruppér per liga → hent phase_ids for disse ligaer
  const leagueIds = [...new Set(activeMatches.map(m => m.league_id))]

  const { data: leagues } = await supabaseAdmin
    .from('leagues')
    .select('id, bold_phase_id')
    .in('id', leagueIds)
    .not('bold_phase_id', 'is', null)

  if (!leagues?.length) return { updated, errors }

  // 3. Hent live data fra Bold for disse ligaer (ét kald per liga)
  const boldMatchMap = new Map<number, { home_score: number; away_score: number; status: string }>()

  for (const league of leagues) {
    try {
      const url = `${BOLD_MATCHES_API}?phase_ids=${league.bold_phase_id}&limit=50&page=1&offset=0`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BodegaBets/1.0', 'Accept': 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) continue

      const data = await res.json()
      for (const m of (data.matches ?? [])) {
        const match = m.match
        if (!match) continue

        const status = match.status_type === 'finished'
          ? 'finished'
          : match.status_type === 'inprogress'
            ? (match.paused ? 'halftime' : 'live')
            : 'notstarted'

        if (status === 'notstarted') continue

        boldMatchMap.set(match.id, {
          home_score: match.home_team?.score ?? 0,
          away_score: match.away_team?.score ?? 0,
          status,
        })
      }
    } catch (e) {
      errors.push(`Bold API fejl for liga ${league.id}: ${e}`)
    }
  }

  // 4. Opdater kun de kampe der har nye scores
  for (const match of activeMatches) {
    if (!match.bold_match_id) continue
    const boldData = boldMatchMap.get(match.bold_match_id)
    if (!boldData) continue

    const { error } = await supabaseAdmin
      .from('league_matches')
      .update({
        home_score: boldData.home_score,
        away_score: boldData.away_score,
        status: boldData.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    if (error) {
      errors.push(`Opdatering fejlede for kamp ${match.id}: ${error.message}`)
    } else {
      updated++
      // Propagér også til matches-tabellen
      await supabaseAdmin
        .from('matches')
        .update({
          home_score: boldData.home_score,
          away_score: boldData.away_score,
          status: boldData.status === 'finished' ? 'finished' : boldData.status === 'halftime' ? 'halftime' : 'live',
        })
        .eq('league_match_id', match.id)
    }
  }

  console.log(`[syncMatchScores] ${updated} kampe opdateret`)
  return { updated, errors }
}
