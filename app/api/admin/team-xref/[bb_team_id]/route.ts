/**
 * PATCH /api/admin/team-xref/[bb_team_id]
 * Opdaterer bold_team_id og bold_tournament_id for et hold.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bb_team_id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { bb_team_id: bbTeamIdParam } = await params
  const bbTeamId = parseInt(bbTeamIdParam, 10)
  if (isNaN(bbTeamId)) {
    return NextResponse.json({ error: 'Ugyldig bb_team_id' }, { status: 400 })
  }

  let body: { bold_team_id: number; bold_tournament_id: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 })
  }

  const { bold_team_id, bold_tournament_id } = body
  if (
    typeof bold_team_id !== 'number' ||
    typeof bold_tournament_id !== 'number'
  ) {
    return NextResponse.json(
      { error: 'bold_team_id og bold_tournament_id skal være tal' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('team_xref')
    .update({ bold_team_id, bold_tournament_id })
    .eq('bb_team_id', bbTeamId)

  if (error) {
    console.error('[admin/team-xref] PATCH', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
