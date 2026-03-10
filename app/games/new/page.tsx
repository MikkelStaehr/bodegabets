import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import NewGameForm from '@/components/NewGameForm'
import type { League } from '@/types'

export default async function NewGamePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, country, is_active, total_matches, fixturedownload_slug, bold_slug')
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-text-warm mb-2">Nyt spilrum</p>
        <h1 className="font-display text-forest text-5xl font-bold leading-none mb-2">Opret spilrum</h1>
        <p className="font-body text-text-warm text-base font-light mb-12">
          Du får en invitationskode du kan dele med vennerne.
        </p>

        <NewGameForm leagues={(leagues ?? []) as League[]} />
      </div>
    </div>
  )
}
