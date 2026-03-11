import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import SyncTesterClient from './SyncTesterClient'

export default async function SyncTesterPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  const { data: leagues } = await supabaseAdmin
    .from('leagues')
    .select('id, name, bold_phase_id')
    .not('bold_phase_id', 'is', null)
    .order('name')

  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="font-condensed uppercase text-[#7a7060] mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
          Admin
        </p>
        <h1 className="font-['Playfair_Display'] text-[#1a3329] font-bold mb-6" style={{ fontSize: '28px' }}>
          Sync Tester (dry-run)
        </h1>

        <SyncTesterClient leagues={leagues ?? []} />
      </div>
    </div>
  )
}
