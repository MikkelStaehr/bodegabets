import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import LineupLab from '@/components/cycling/LineupLab'

export const dynamic = 'force-dynamic'

// Skjult/unlisted sandbox — ikke linket nogen steder. Kun krav: logget ind.
export default async function LabPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="bg-forest rounded-sm p-6 mb-6">
          <p className="label-caps text-gold mb-2">Sandbox — intern test</p>
          <h1 className="font-display text-[28px] font-bold text-cream leading-tight mb-3">
            Rolle-lab
          </h1>
          <p className="font-body text-[13px] text-cream/70 leading-relaxed">
            Byg en rolle-først opstilling med abstrakte ryttere (kategori + placering) og se
            point-effekten live. Test om rollerne komplementerer hinanden — fx et spurt-tog
            (1 spurter + 2 leadout) vs. 3 selvstændige finishers. Tallene rører ikke den rigtige data.
          </p>
        </div>

        <LineupLab />
      </div>
    </div>
  )
}
