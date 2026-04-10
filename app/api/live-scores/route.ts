/**
 * GET /api/live-scores?round_id=X
 * Henter live scores fra Bold API for alle kampe i en runde.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getLiveScores } from '@/lib/getLiveScores'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const roundId = req.nextUrl.searchParams.get('round_id')
  if (!roundId) {
    return NextResponse.json({ error: 'round_id mangler' }, { status: 400 })
  }

  const roundIdNum = parseInt(roundId, 10)
  if (isNaN(roundIdNum)) {
    return NextResponse.json({ error: 'Ugyldig round_id' }, { status: 400 })
  }

  try {
    const results = await getLiveScores(roundIdNum)
    return NextResponse.json(results)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukendt fejl'
    console.error('[live-scores]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
