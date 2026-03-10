import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

/** PATCH /api/admin/matches/[id] — opdater kampresultat manuelt */
export async function PATCH(req: NextRequest, { params }: Props) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const matchId = parseInt(id)
  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'Ugyldigt match_id' }, { status: 400 })
  }

  const body = await req.json()
  const { home_score, away_score, home_ht_score, away_ht_score, first_scorer, yellow_cards, red_cards } =
    body as {
      home_score?: number
      away_score?: number
      home_ht_score?: number
      away_ht_score?: number
      first_scorer?: string
      yellow_cards?: number
      red_cards?: number
    }

  if (home_score === undefined || away_score === undefined) {
    return NextResponse.json({ error: 'home_score og away_score er påkrævet' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    home_score,
    away_score,
    status: 'finished',
  }
  if (home_ht_score !== undefined) updatePayload.home_ht_score = home_ht_score
  if (away_ht_score !== undefined) updatePayload.away_ht_score = away_ht_score
  if (first_scorer !== undefined) updatePayload.first_scorer = first_scorer || null
  if (yellow_cards !== undefined) updatePayload.yellow_cards = yellow_cards
  if (red_cards !== undefined) updatePayload.red_cards = red_cards

  const { data, error } = await supabaseAdmin
    .from('matches')
    .update(updatePayload)
    .eq('id', matchId)
    .select('id, home_team, away_team, home_score, away_score, status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, match: data })
}
