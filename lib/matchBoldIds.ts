/**
 * matchBoldIds.ts
 * Matcher eksisterende kampe med Bold.dk IDs.
 * Bruges af både CLI-script og admin API.
 */

import { fetchBoldMatches } from '@/lib/boldApi'
import { supabaseAdmin } from '@/lib/supabase'

export type MatchBoldResult = {
  matched: number
  details: Array<{
    home_team: string
    away_team: string
    bold_id: number
    match_ids: number[]
  }>
  errors: string[]
}

export async function runMatchBoldIds(): Promise<MatchBoldResult> {
  const result: MatchBoldResult = { matched: 0, details: [], errors: [] }

  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  for (const date of dates) {
    const boldMatches = await fetchBoldMatches(date)

    for (const { match } of boldMatches) {
      const dateStr = match.date.split(' ')[0]

      const { data: dbMatches } = await supabaseAdmin
        .from('matches')
        .select('id, home_team, away_team')
        .ilike('home_team', `%${match.home_team.name}%`)
        .ilike('away_team', `%${match.away_team.name}%`)
        .gte('kickoff_at', `${dateStr}T00:00:00`)
        .lte('kickoff_at', `${dateStr}T23:59:59`)

      if (dbMatches?.length) {
        const ids = dbMatches.map((m) => m.id)
        const { error } = await supabaseAdmin
          .from('matches')
          .update({ bold_match_id: match.id })
          .in('id', ids)

        if (error) {
          result.errors.push(`${match.home_team.name} vs ${match.away_team.name}: ${error.message}`)
        } else {
          result.matched += ids.length
          result.details.push({
            home_team: match.home_team.name,
            away_team: match.away_team.name,
            bold_id: match.id,
            match_ids: ids,
          })
        }
      }
    }

    await new Promise((r) => setTimeout(r, 1000))
  }

  return result
}

export async function logMatchBoldRun(
  result: MatchBoldResult,
  status: 'ok' | 'error',
  errorMessage?: string
) {
  await supabaseAdmin.from('bold_match_logs').insert({
    matches_matched: result.matched,
    details: result.details,
    status,
    error_message: errorMessage ?? null,
  })
}
