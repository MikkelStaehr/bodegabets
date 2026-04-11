import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import NewCyclingGameForm from '@/components/games/NewCyclingGameForm'

export default async function NewCyclingGamePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: races } = await supabase
    .from('cycling_races')
    .select('id, name, pcs_slug, race_type, profile, start_date')
    .eq('year', 2026)
    .order('start_date', { ascending: true })

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-text-warm mb-2">Nyt spilrum</p>
        <h1 className="font-display text-forest text-5xl font-bold leading-none mb-2">Cykling</h1>
        <p className="font-body text-text-warm text-base font-light mb-12">
          Vælg løb, invitér vennerne og byg dit hold.
        </p>

        <NewCyclingGameForm races={races ?? []} />
      </div>
    </div>
  )
}
