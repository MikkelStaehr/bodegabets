import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import NewGameForm from '@/components/NewGameForm'
import type { League } from '@/types'

export default async function NewGamePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: leagues }, { data: tournaments }] = await Promise.all([
    supabase
      .from('leagues')
      .select('id, name, country, is_active, fixturedownload_slug, bold_slug')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('tournaments')
      .select('name, logo_url')
      .not('logo_url', 'is', null),
  ])

  // Match tournament logos to leagues by name
  const logoMap = new Map<string, string>()
  for (const t of tournaments ?? []) {
    if (t.logo_url) logoMap.set(t.name as string, t.logo_url as string)
  }
  const leaguesWithLogos = (leagues ?? []).map((l) => ({
    ...l,
    logo_url: logoMap.get(l.name as string) ?? null,
  })) as League[]

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-text-warm mb-2">Nyt spilrum</p>
        <h1 className="font-display text-forest text-5xl font-bold leading-none mb-2">Opret spilrum</h1>
        <p className="font-body text-text-warm text-base font-light mb-12">
          Du får en invitationskode du kan dele med vennerne.
        </p>

        <NewGameForm leagues={leaguesWithLogos} />
      </div>
    </div>
  )
}
