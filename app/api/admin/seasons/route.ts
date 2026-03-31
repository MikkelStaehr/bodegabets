import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select(`
      id, name,
      seasons (
        id, tournament_id, name, bold_phase_id, is_active, start_date, end_date
      )
    `)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tournaments: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({})) as {
    tournament_id?: number
    name?: string
    bold_phase_id?: number | null
    is_active?: boolean
    start_date?: string | null
    end_date?: string | null
  }

  if (!body.tournament_id || !body.name?.trim()) {
    return NextResponse.json({ error: 'tournament_id og name er påkrævet' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('seasons')
    .insert({
      tournament_id: body.tournament_id,
      name: body.name.trim(),
      bold_phase_id: body.bold_phase_id ?? null,
      is_active: body.is_active ?? false,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, season: data })
}
