import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import VerifyClient from './VerifyClient'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ redirect?: string }> }

export default async function AdminVerifyPage({ searchParams }: Props) {
  const { redirect: redirectTo } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificér admin-status (sikkerhed: kan ikke nås direkte uden admin)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  // Hent verified TOTP factor
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const totp = factorsData?.totp?.find((f) => f.status === 'verified')

  if (!totp) {
    // Ingen MFA enrolled — bør ikke ske (middleware redirecter allerede)
    redirect('/profile/security?reason=admin-required')
  }

  return (
    <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-[#7a7060] mb-2 text-center">
          Sikkerhedsverifikation
        </p>
        <h1 className="font-display text-3xl font-bold text-[#1a3329] mb-2 text-center">
          Bekræft 2FA
        </h1>
        <p className="font-body text-sm text-[#5C5C4A] mb-8 text-center">
          Indtast koden fra din authenticator-app for at få adgang til admin-panelet.
        </p>

        <VerifyClient factorId={totp.id} redirectTo={redirectTo ?? '/admin'} />
      </div>
    </div>
  )
}
