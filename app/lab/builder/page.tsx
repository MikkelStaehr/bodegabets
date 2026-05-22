import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import LineupBuilderPreview from '@/components/cycling/LineupBuilderPreview'

export const dynamic = 'force-dynamic'

// Skjult/unlisted test-side — viser hvordan den rolle-først lineup builder
// vil se ud med rigtige(-agtige) ryttere + den nye leadout-rolle.
export default async function LabBuilderPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="bg-forest rounded-sm p-6 mb-6">
          <p className="label-caps text-gold mb-2">Sandbox — builder-preview</p>
          <h1 className="font-display text-[28px] font-bold text-cream leading-tight mb-3">
            Lineup builder (rolle-først)
          </h1>
          <p className="font-body text-[13px] text-cream/70 leading-relaxed">
            Sådan kan opstillingen se ud: <span className="text-cream font-semibold">8 rolle-slots</span> som et rigtigt
            cykelhold, med <span className="text-cream font-semibold">dynamiske roller</span> — skift profil og se
            formationen morphe (flad dropper klatreren, bjerg dropper spurteren). En equipier fra spurterens hold
            fungerer som leadout og udløser spurt-toget. Sample-ryttere — rører ikke den rigtige data.
          </p>
        </div>

        <LineupBuilderPreview />
      </div>
    </div>
  )
}
