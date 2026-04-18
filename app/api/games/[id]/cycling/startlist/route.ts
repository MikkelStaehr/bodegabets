import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }

// GET /api/games/[id]/cycling/startlist?race_id=UUID
// Returnerer ryttere på startlisten for et race (til f.eks. hviledag-transfer).

export async function GET(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id: gameId } = await params
  const raceId = req.nextUrl.searchParams.get('race_id')
  if (!raceId) return NextResponse.json({ error: 'race_id mangler' }, { status: 400 })

  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', Number(gameId))
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  const { data: startlist } = await supabaseAdmin
    .from('cycling_startlists')
    .select(`
      rider_id, confirmed,
      rider:cycling_riders!inner(id, first_name, last_name, team_name, category, team_logo_url, photo_url)
    `)
    .eq('race_id', raceId)

  const riders = (startlist ?? []).map((row) => {
    const r = row.rider as unknown as {
      id: string; first_name: string; last_name: string
      team_name: string; category: number; team_logo_url: string | null; photo_url: string | null
    }
    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      team_name: r.team_name,
      category: r.category,
      team_logo_url: r.team_logo_url,
      photo_url: r.photo_url,
      confirmed: Boolean(row.confirmed),
    }
  })

  return NextResponse.json({ riders })
}
