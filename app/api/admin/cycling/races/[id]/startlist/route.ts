import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id: raceId } = await params
  if (!raceId) {
    return NextResponse.json({ error: 'Invalid race id' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('cycling_startlists')
      .select(`
        bib_number,
        confirmed,
        rider:cycling_riders!inner(
          id,
          first_name,
          last_name,
          team_name,
          category
        )
      `)
      .eq('race_id', raceId)
      .order('bib_number', { ascending: true })

    if (error) {
      console.error('[cycling/startlist]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten the joined rider data
    const riders = (data ?? []).map((row) => {
      const r = row.rider as unknown as {
        id: string
        first_name: string
        last_name: string
        team_name: string
        category: number
      }
      return {
        bib_number: row.bib_number,
        first_name: r.first_name,
        last_name: r.last_name,
        team_name: r.team_name,
        category: r.category,
      }
    })

    return NextResponse.json({ riders })
  } catch (err) {
    console.error('[cycling/startlist] Unexpected error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
