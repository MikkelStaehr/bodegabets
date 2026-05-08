import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import SecurityClient from './SecurityClient'

export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hent enrolled MFA factors
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const totpFactors = (factorsData?.totp ?? []).map((f) => ({
    id: f.id,
    friendly_name: f.friendly_name,
    status: f.status,
    created_at: f.created_at,
  }))

  // Tjek om bruger er admin (vis ekstra warning hvis ja og uden MFA)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-[#7a7060] mb-2">
          Konto-sikkerhed
        </p>
        <h1 className="font-display text-4xl font-bold text-[#1a3329] mb-8">
          To-faktor godkendelse
        </h1>

        <SecurityClient
          factors={totpFactors}
          isAdmin={profile?.is_admin === true}
          userEmail={user.email ?? ''}
        />
      </div>
    </div>
  )
}
