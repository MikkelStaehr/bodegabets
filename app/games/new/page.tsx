import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

export default async function ChooseSportPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-warm-gray mb-2">
          Nyt spilrum
        </p>
        <h1 className="font-display text-forest text-5xl font-bold leading-none mb-2">
          Vælg sport
        </h1>
        <p className="font-body text-warm-gray text-base font-light mb-12">
          Hvilken sport vil du spille med vennerne?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Fodbold */}
          <Link
            href="/games/fodbold/new"
            className="group border border-warm-border bg-cream hover:bg-cream-dark transition-colors p-6 flex flex-col items-center text-center"
            style={{ borderRadius: '2px' }}
          >
            <span className="text-4xl mb-4">&#9917;</span>
            <h2 className="font-condensed font-bold text-forest text-lg uppercase tracking-wide mb-2">
              Fodbold
            </h2>
            <p className="font-body text-[13px] text-warm-gray leading-relaxed">
              Bet på kampe fra Premier League, La Liga, Serie A og meget mere.
            </p>
          </Link>

          {/* Cykling */}
          <Link
            href="/games/cykling/new"
            className="group relative border border-warm-border bg-cream hover:bg-cream-dark transition-colors p-6 flex flex-col items-center text-center"
            style={{ borderRadius: '2px' }}
          >
            <span
              className="absolute top-3 right-3 font-condensed text-[10px] font-bold uppercase tracking-widest text-cream bg-forest px-2 py-0.5"
              style={{ borderRadius: '2px' }}
            >
              Ny
            </span>
            <span className="text-4xl mb-4">&#128692;</span>
            <h2 className="font-condensed font-bold text-forest text-lg uppercase tracking-wide mb-2">
              Cykling
            </h2>
            <p className="font-body text-[13px] text-warm-gray leading-relaxed">
              Byg dit hold og følg Tour de France, klassikerne og monumenterne.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
