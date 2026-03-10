import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { syncResults, buildGameRounds, runLeagueSync } from '@/lib/syncLeagueMatches'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

type SyncBody =
  | { all: true }
  | { league_id: number; game_id?: number }

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as SyncBody

  try {
    // Fuld sync: alle aktive ligaer via API-Football
    if ('all' in body && body.all) {
      const results = await runLeagueSync()
      const total = results.reduce((s, r) => s + r.synced, 0)
      return NextResponse.json({ ok: true, output: `Sync: ${results.length} ligaer, ${total} kampe opdateret`, results })
    }

    if ('league_id' in body) {
      const { data: league } = await supabaseAdmin
        .from('leagues')
        .select('id, name, bold_slug')
        .eq('id', body.league_id)
        .single()

      if (!league) {
        return NextResponse.json({ error: 'Liga ikke fundet' }, { status: 404 })
      }

      let synced = 0
      const errors: string[] = []

      // Sync resultater fra Bold.dk
      if (!league.bold_slug) {
        errors.push(`Ingen bold_slug for '${league.name}'`)
      } else {
        const res = await syncResults(league.id, league.bold_slug)
        synced += res.synced
        errors.push(...res.errors)
      }

      // Byg runder i spilrum
      let rounds_created = 0, matches_created = 0, matches_updated = 0

      if (body.game_id) {
        const s = await buildGameRounds(body.game_id, league.id)
        rounds_created = s.rounds_created
        matches_created = s.matches_created
        matches_updated = s.matches_updated
      } else {
        const { data: games } = await supabaseAdmin
          .from('games')
          .select('id')
          .eq('league_id', league.id)
          .eq('status', 'active')

        for (const g of (games ?? []) as { id: number }[]) {
          const s = await buildGameRounds(g.id, league.id)
          rounds_created  += s.rounds_created
          matches_created += s.matches_created
          matches_updated += s.matches_updated
        }
      }

      return NextResponse.json({
        ok: true,
        output: `${synced} kampe synkroniseret, +${rounds_created} runder, +${matches_created} kampe`,
        synced,
        rounds_created,
        matches_created,
        matches_updated,
        errors,
      })
    }

    return NextResponse.json({ error: 'Ugyldig body' }, { status: 400 })
  } catch (err) {
    console.error('[admin/sync]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
