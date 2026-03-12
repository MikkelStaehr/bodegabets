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
    .from('leagues')
    .insert({
      name: body.name.trim(),
      country: body.country?.trim() ?? 'World',
      is_active: true,
      fixturedownload_slug: body.fixturedownload_slug?.trim() || null,
      bold_slug: body.bold_slug?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, league: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { league_id, fixturedownload_slug } = await req.json() as {
    league_id: number
    fixturedownload_slug: string | null
  }

  if (!league_id) return NextResponse.json({ error: 'league_id påkrævet' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('leagues')
    .update({
      fixturedownload_slug: fixturedownload_slug?.trim() || null,
    })
    .eq('id', league_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
