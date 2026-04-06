import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

export default async function NewCyclingGamePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-warm-gray mb-2">Nyt spilrum</p>
        <h1 className="font-display text-forest text-5xl font-bold leading-none mb-2">Cykling</h1>
        <p className="font-body text-warm-gray text-base font-light mb-12">
          Cykling-spilrum er under udvikling.
        </p>

        <div
          className="border border-warm-border bg-cream-dark p-8 text-center"
          style={{ borderRadius: '2px' }}
        >
          <p className="font-condensed text-[15px] font-bold uppercase tracking-[0.08em] text-forest mb-2">
            Kommer snart
          </p>
          <p className="font-body text-[14px] text-warm-gray mb-6">
            Vi arbejder på cykling-fantasy med hold, etaper og klassikere.
          </p>
          <Link
            href="/games/new"
            className="inline-block font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-forest px-5 py-2.5 border border-warm-border hover:bg-cream"
            style={{ borderRadius: '2px' }}
          >
            Tilbage til sport-valg
          </Link>
        </div>
      </div>
    </div>
  )
}
