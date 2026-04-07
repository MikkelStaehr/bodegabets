import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import SquadBuilder from '@/components/cycling/SquadBuilder'
import type { Rider } from '@/components/cycling/SquadBuilder'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

export default async function SquadPage({ params }: Props) {
  const { id } = await params
  const gameId = Number(id)

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch game
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name, sport')
    .eq('id', gameId)
    .single()

  if (!game) notFound()
  if (game.sport !== 'cycling') redirect(`/games/${gameId}`)

  // Verify membership
  const { data: membership } = await supabaseAdmin
    .from('game_members')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect(`/games/${gameId}`)

  // Find races in this game
  const { data: gameRaces } = await supabaseAdmin
    .from('cycling_game_races')
    .select('race_id')
    .eq('game_id', gameId)

  const raceIds = (gameRaces ?? []).map((gr) => gr.race_id)

  // Find the next active/upcoming race with a startlist
  let availableRiders: Rider[] = []

  if (raceIds.length > 0) {
    // Get races sorted by date, prefer active then upcoming
    const { data: races } = await supabaseAdmin
      .from('cycling_races')
      .select('id, name, status, start_date')
      .in('id', raceIds)
      .in('status', ['active', 'upcoming'])
      .order('start_date', { ascending: true })

    // Pick first active, or first upcoming
    const targetRace =
      (races ?? []).find((r) => r.status === 'active') ??
      (races ?? []).find((r) => r.status === 'upcoming') ??
      null

    if (targetRace) {
      // Fetch startlist riders joined with cycling_riders
      const { data: startlist } = await supabaseAdmin
        .from('cycling_startlists')
        .select(`
          rider:cycling_riders!inner(
            id, first_name, last_name, team_name, category, team_logo_url, photo_url
          )
        `)
        .eq('race_id', targetRace.id)

      availableRiders = (startlist ?? []).map((row) => {
        const r = row.rider as unknown as Rider
        return {
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          team_name: r.team_name,
          category: r.category,
          team_logo_url: r.team_logo_url,
          photo_url: r.photo_url,
        }
      })

      // Sort by category then last name
      availableRiders.sort((a, b) => {
        if (a.category !== b.category) return a.category - b.category
        return a.last_name.localeCompare(b.last_name)
      })
    }
  }

  // Fetch existing squad
  let initialSquad: Rider[] = []

  const { data: existingSquad } = await supabaseAdmin
    .from('cycling_squads')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingSquad) {
    const { data: squadRiders } = await supabaseAdmin
      .from('cycling_squad_riders')
      .select(`
        rider:cycling_riders!inner(
          id, first_name, last_name, team_name, category, team_logo_url, photo_url
        )
      `)
      .eq('squad_id', existingSquad.id)

    initialSquad = (squadRiders ?? []).map((row) => {
      const r = row.rider as unknown as Rider
      return {
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        team_name: r.team_name,
        category: r.category,
        team_logo_url: r.team_logo_url,
        photo_url: r.photo_url,
      }
    })
  }

  return (
    <div className="min-h-screen" style={{ background: '#F2EDE4' }}>
      {/* Header */}
      <div style={{ background: '#1E3A5F', color: '#F2EDE4', padding: '20px 16px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(242,237,228,0.5)',
              marginBottom: 4,
            }}
          >
            {game.name}
          </p>
          <h1
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#F2EDE4',
              margin: 0,
            }}
          >
            Brutto trup
          </h1>
          <p
            style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 13,
              color: 'rgba(242,237,228,0.6)',
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            Vælg op til 25 ryttere. Max 3 kat 1, 5 kat 2, 5 kat 3, 5 kat 4, 7 kat 5. Max 3 fra samme hold.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>
        {availableRiders.length === 0 ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              border: '1px dashed #C8BEA8',
              borderRadius: 2,
              color: '#6b6b6b',
              fontFamily: "'Barlow', sans-serif",
              fontSize: 14,
            }}
          >
            Ingen startliste tilgængelig endnu. Startlister offentliggøres tæt på løbsdagen.
          </div>
        ) : (
          <SquadBuilder
            gameId={gameId}
            availableRiders={availableRiders}
            initialSquad={initialSquad}
          />
        )}
      </div>
    </div>
  )
}
