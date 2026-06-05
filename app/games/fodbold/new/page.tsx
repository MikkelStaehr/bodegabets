import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import NewGameForm from '@/components/games/NewGameForm'
import type { Tournament, Season } from '@/types'

export default async function NewFootballGamePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Tjek subscription-status — ikke-betalende brugere kan kun oprette spilrum
  // bundet til free-event sæsoner (fx VM 2026 under tryout-kampagnen)
  const { data: viewerProfile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, is_admin')
    .eq('id', user.id)
    .maybeSingle()
  const isPaying =
    viewerProfile?.subscription_status === 'active' ||
    viewerProfile?.subscription_status === 'comped' ||
    viewerProfile?.is_admin === true

  const [{ data: tournaments }, { data: seasons }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, name, logo_url, bold_id, bold_slug, is_cup')
      .order('name', { ascending: true }),
    supabase
      .from('seasons')
      .select('id, tournament_id, name, bold_phase_ids, is_free_event')
      .order('id', { ascending: false }),
  ])

  // Build map: tournament_id → latest season (first match since ordered desc)
  const seasonMap: Record<number, Season> = {}
  for (const s of seasons ?? []) {
    const tid = s.tournament_id as number
    if (!seasonMap[tid]) {
      seasonMap[tid] = s as Season
    }
  }

  // Filtrér: gratis-brugere ser kun turneringer med free-event sæson (VM 2026)
  const tournamentsWithSeason = (tournaments ?? []).filter((t) => {
    const season = seasonMap[t.id as number]
    if (!season) return false
    if (isPaying) return true
    return season.is_free_event === true
  }) as Tournament[]

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-text-warm mb-2">Nyt spilrum</p>
        <h1 className="font-display text-forest text-5xl font-bold leading-none mb-2">Opret spilrum</h1>
        <p className="font-body text-text-warm text-base font-light mb-12">
          {isPaying
            ? 'Du får en invitationskode du kan dele med vennerne.'
            : 'Gratis adgang under VM. Få en invitationskode du kan dele med vennerne.'}
        </p>

        <NewGameForm tournaments={tournamentsWithSeason} seasonMap={seasonMap} />
      </div>
    </div>
  )
}
