import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

/** POST — opret ny liga */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json() as {
    name: string
    country?: string
    fixturedownload_slug?: string | null
    bold_slug?: string | null
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name er påkrævet' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .insert({
      name: body.name.trim(),
      country: body.country?.trim() ?? 'World',
      is_active: true,
      bold_slug: body.bold_slug?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, league: data, tournament: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { tournament_id, league_id, bold_slug } = await req.json() as {
    tournament_id?: number
    league_id?: number
    bold_slug?: string | null
  }

  const id = tournament_id ?? league_id
  if (!id) return NextResponse.json({ error: 'tournament_id påkrævet' }, { status: 400 })

  const { error } = bold_slug !== undefined
    ? await supabaseAdmin.from('tournaments').update({ bold_slug: bold_slug?.trim() || null }).eq('id', id)
    : { error: null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
