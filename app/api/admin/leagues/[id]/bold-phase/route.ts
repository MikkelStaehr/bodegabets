/**
 * PATCH /api/admin/leagues/[id]/bold-phase
 * Opdaterer bold_phase_id for en liga.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id: leagueIdParam } = await params
  const leagueId = parseInt(leagueIdParam, 10)
  if (isNaN(leagueId)) {
    return NextResponse.json({ error: 'Ugyldig league id' }, { status: 400 })
  }

  let body: { bold_phase_id: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 })
  }

  const { bold_phase_id } = body
  if (typeof bold_phase_id !== 'number') {
    return NextResponse.json(
      { error: 'bold_phase_id skal være et tal' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('leagues')
    .update({ bold_phase_id })
    .eq('id', leagueId)

  if (error) {
    console.error('[admin/leagues/bold-phase] PATCH', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
