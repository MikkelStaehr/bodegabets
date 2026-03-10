import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

/** PATCH /api/admin/rounds/[id] — opdater rundestatus */
export async function PATCH(req: NextRequest, { params }: Props) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const roundId = parseInt(id)
  if (isNaN(roundId)) {
    return NextResponse.json({ error: 'Ugyldigt round_id' }, { status: 400 })
  }

  const body = await req.json()
  const { status } = body as { status: 'upcoming' | 'open' | 'closed' | 'finished' }

  const validStatuses = ['upcoming', 'open', 'closed', 'finished']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('rounds')
    .update({ status })
    .eq('id', roundId)
    .select('id, name, status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, round: data })
}
