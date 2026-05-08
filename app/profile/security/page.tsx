import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import SecurityClient from './SecurityClient'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ reason?: string }> }

export default async function SecurityPage({ searchParams }: Props) {
  const { reason } = await searchParams
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

        {reason === 'admin-required' && (
          <div
            className="mb-6 p-4 rounded-sm border"
            style={{ background: 'rgba(200,57,43,0.08)', borderColor: 'rgba(200,57,43,0.3)' }}
          >
            <p className="font-condensed text-xs uppercase tracking-[0.08em] font-bold mb-1" style={{ color: '#C8392B' }}>
              ⚠ Admin-adgang kræver 2FA
            </p>
            <p className="font-body text-sm" style={{ color: '#1a1a1a' }}>
              Du blev sendt hertil fordi admin-panelet kræver to-faktor godkendelse.
              Aktivér 2FA herunder for at få adgang.
            </p>
          </div>
        )}

        <SecurityClient
          factors={totpFactors}
          isAdmin={profile?.is_admin === true}
          userEmail={user.email ?? ''}
        />
      </div>
    </div>
  )
}
