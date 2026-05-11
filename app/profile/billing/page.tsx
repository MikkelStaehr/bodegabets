import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import ManageButton from './ManageButton'

export const metadata: Metadata = {
  title: 'Medlemskab — Bodega Bets',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: 'Intet medlemskab', color: 'text-warm-gray' },
  active: { label: 'Aktiv', color: 'text-forest' },
  comped: { label: 'Aktiv (gratis adgang)', color: 'text-gold-dark' },
  past_due: { label: 'Betaling fejlede', color: 'text-vintage-red' },
  canceled: { label: 'Opsagt', color: 'text-warm-gray' },
}

export default async function BillingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/profile/billing')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, stripe_customer_id, subscription_current_period_end')
    .eq('id', user.id)
    .single()

  const status = profile?.subscription_status ?? 'none'
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.none
  const periodEnd = profile?.subscription_current_period_end
    ? new Date(profile.subscription_current_period_end).toLocaleDateString('da-DK', {
        timeZone: 'Europe/Copenhagen',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-12 pb-24">
        <p className="font-condensed text-xs uppercase tracking-[0.14em] text-warm-taupe mb-2">
          Konto
        </p>
        <h1 className="font-display text-4xl font-bold text-forest mb-8">
          Medlemskab
        </h1>

        <div className="bg-cream-dark border border-warm-border rounded-sm p-6 lg:p-8">
          <div className="flex items-baseline justify-between mb-6">
            <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-warm-taupe">
              Status
            </span>
            <span className={`font-condensed font-bold text-sm uppercase tracking-[0.08em] ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          {(status === 'active' || status === 'past_due') && periodEnd && (
            <div className="flex items-baseline justify-between mb-6">
              <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-warm-taupe">
                {status === 'past_due' ? 'Forfaldsdato' : 'Næste fornyelse'}
              </span>
              <span className="font-body text-sm text-ink">{periodEnd}</span>
            </div>
          )}

          {status === 'active' || status === 'past_due' ? (
            <>
              <div className="my-6 border-t border-dashed border-warm-border" />
              <p className="font-body text-sm text-warm-gray leading-relaxed mb-4">
                Du kan opdatere betalingsmetode, downloade fakturaer eller opsige
                dit medlemskab gennem Stripe-portalen.
              </p>
              <ManageButton />
            </>
          ) : status === 'comped' ? (
            <>
              <div className="my-6 border-t border-dashed border-warm-border" />
              <p className="font-body text-sm text-warm-gray leading-relaxed">
                Du har gratis adgang til Bodega Bets. Tak fordi du er med fra start.
              </p>
            </>
          ) : (
            <>
              <div className="my-6 border-t border-dashed border-warm-border" />
              <p className="font-body text-sm text-warm-gray leading-relaxed mb-4">
                Du har ingen aktivt medlemskab. Tegn et for at få adgang til
                spilrum, lineups og championship.
              </p>
              <Link
                href="/subscribe"
                className="inline-flex items-center justify-center px-6 py-3 bg-forest text-cream font-condensed font-bold text-[12px] uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity self-start"
              >
                Tegn medlemskab →
              </Link>
            </>
          )}
        </div>

        <p className="mt-6 font-body text-sm text-warm-taupe">
          <Link href="/profile" className="underline hover:text-forest transition-colors">
            ← Tilbage til profil
          </Link>
        </p>
      </div>
    </div>
  )
}
