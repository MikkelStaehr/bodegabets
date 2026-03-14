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

  const { id: idParam } = await params
  const targetId = parseInt(idParam, 10)
  if (isNaN(targetId)) {
    return NextResponse.json({ error: 'Ugyldig id' }, { status: 400 })
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

  // bold_phase_id er nu på seasons — opdater aktiv sæson for denne turnering
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id')
    .eq('tournament_id', targetId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!season) {
    return NextResponse.json(
      { error: 'Ingen aktiv sæson fundet for turneringen' },
      { status: 404 }
    )
  }

  const { error } = await supabaseAdmin
    .from('seasons')
    .update({ bold_phase_id })
    .eq('id', season.id)

  if (error) {
    console.error('[admin/leagues/bold-phase] PATCH', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
