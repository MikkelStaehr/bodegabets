import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const roundId = parseInt(id)
  if (isNaN(roundId)) return NextResponse.json({ error: 'Ugyldigt ID' }, { status: 400 })

  const { data: round } = await supabaseAdmin
    .from('championship_rounds')
    .select('id')
    .eq('id', roundId)
    .single()

  if (!round) return NextResponse.json({ error: 'Runde ikke fundet' }, { status: 404 })

  // Slet tilknyttede kampe først, derefter runden
  await supabaseAdmin.from('championship_round_matches').delete().eq('championship_round_id', roundId)
  const { error } = await supabaseAdmin.from('championship_rounds').delete().eq('id', roundId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
