import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import AddRacesForm from '@/components/cycling/AddRacesForm'

type Props = { params: Promise<{ id: string }> }

export default async function AddRacesPage({ params }: Props) {
  const { id } = await params
  const gameId = Number(id)
  if (isNaN(gameId)) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name, host_id, sport, status')
    .eq('id', gameId)
    .single()

  if (!game || game.sport !== 'cycling') notFound()
  if (game.host_id !== user.id) {
    redirect(`/games/${gameId}`)
  }

  const [racesRes, existingRes] = await Promise.all([
    supabaseAdmin
      .from('cycling_races')
      .select('id, name, pcs_slug, race_type, profile, start_date, end_date, status')
      .eq('year', 2026)
      .order('start_date', { ascending: true }),
    supabaseAdmin
      .from('cycling_game_races')
      .select('race_id')
      .eq('game_id', gameId),
  ])

  const allRaces = racesRes.data ?? []
  const linkedRaceIds = new Set((existingRes.data ?? []).map((r) => r.race_id as string))

  // Vis kun løb der ikke allerede er tilknyttet
  const availableRaces = allRaces.filter((r) => !linkedRaceIds.has(r.id as string))

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-text-warm mb-2">
          {game.name}
        </p>
        <h1 className="font-display text-forest text-5xl font-bold leading-none mb-2">
          Tilføj løb
        </h1>
        <p className="font-body text-text-warm text-base font-light mb-10">
          Vælg de løb du vil tilføje til spilrummet. Eksisterende blokke og resultater bevares.
          {game.status === 'finished' && (
            <span className="block mt-2 text-forest font-medium">
              Spilrummet er arkiveret — det genaktiveres automatisk når du tilføjer løb.
            </span>
          )}
        </p>

        <AddRacesForm gameId={gameId} races={availableRaces} />
      </div>
    </div>
  )
}
