import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import SubscribeButton from './SubscribeButton'

export const metadata: Metadata = {
  title: 'Tegn medlemskab — Bodega Bets',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ canceled?: string }> }

const RECEIPT_LINES = [
  { label: 'Cykling live-data', value: 'INKLUDERET' },
  { label: 'Fodbold live-data · 20 ligaer', value: 'INKLUDERET' },
  { label: 'Bodega Championship', value: 'INKLUDERET' },
  { label: 'Drift & vedligehold', value: 'INKLUDERET' },
] as const

export default async function SubscribePage({ searchParams }: Props) {
  const { canceled } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/subscribe')

  // Hvis allerede aktiv/comped — send dem videre
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_status === 'active' || profile?.subscription_status === 'comped') {
    redirect('/dashboard')
  }

  // Hent navnet på en aktiv free-event-turnering (typisk VM 2026) så vi kan
  // vise "Skip — spil gratis"-option til ikke-betalende brugere.
  const { data: freeEventSeasonRaw } = await supabaseAdmin
    .from('seasons')
    .select('id, name, tournaments:tournament_id(name)')
    .eq('is_free_event', true)
    .limit(1)
    .maybeSingle()
  const freeEventSeason = freeEventSeasonRaw as unknown as { id: number; name: string; tournaments: { name: string } | { name: string }[] | null } | null
  const freeEventTournament = freeEventSeason?.tournaments
  const freeEventTournamentName = Array.isArray(freeEventTournament)
    ? freeEventTournament[0]?.name
    : freeEventTournament?.name
  const freeEventName = freeEventSeason
    ? (freeEventTournamentName ?? freeEventSeason.name)
    : null

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        {/* Editorial intro — kompakt, fuld bredde */}
        <div className="max-w-3xl mb-10 lg:mb-14">
          <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
            Én pris · ingen profit
          </span>

          <h1 className="mt-3 font-display font-black text-forest text-[36px] lg:text-[52px] leading-[0.95]">
            Bliv medlem af klubben.{' '}
            <em className="not-italic text-gold-dark italic">Spil mod vennerne.</em>
          </h1>

          <p className="mt-5 font-body text-[15px] lg:text-[16px] text-warm-gray leading-relaxed">
            Din krone går til licenser på live etape-resultater, kamp-data og
            statistik fra 20 europæiske ligaer. Ingen rigtige penge i spil.
            Kun ære og prestige.
          </p>

          {canceled === '1' && (
            <div
              className="mt-5 p-4 rounded-sm border"
              style={{ background: 'rgba(200,57,43,0.08)', borderColor: 'rgba(200,57,43,0.3)' }}
            >
              <p className="font-body text-sm text-ink">
                Du afbrød checkout. Ingen betaling er gennemført.
              </p>
            </div>
          )}
        </div>

        {/* To bokse side om side — medlemskab + VM-tryout */}
        <div className={`grid grid-cols-1 ${freeEventName ? 'lg:grid-cols-2' : ''} gap-6 lg:gap-8`}>
          {/* Medlemskab-boks (med kompakt receipt) */}
          <div className="bg-cream-dark border border-warm-border rounded-sm p-7 lg:p-8 flex flex-col">
            <span className="font-condensed font-semibold text-[10px] uppercase tracking-[0.18em] text-warm-taupe">
              Fuldt medlemskab
            </span>
            <h2 className="mt-3 font-display font-black text-forest text-[26px] lg:text-[32px] leading-tight">
              Få det hele med.
            </h2>

            <ul className="mt-5 space-y-2 text-[13px] text-ink">
              {RECEIPT_LINES.map((line) => (
                <li key={line.label} className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{line.label}</span>
                  <span className="flex-shrink-0 text-warm-taupe text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: "'Courier New', monospace" }}>
                    {line.value}
                  </span>
                </li>
              ))}
            </ul>

            <div className="my-5 border-t border-dashed border-warm-border" />

            <div className="flex items-baseline justify-between mb-6">
              <span className="font-condensed font-bold text-[11px] uppercase tracking-[0.14em] text-forest">
                Total
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-display font-black text-forest text-[28px] lg:text-[32px] leading-none">
                  €1.00
                </span>
                <span className="text-[10px] text-warm-taupe uppercase tracking-[0.08em]">/måned</span>
              </span>
            </div>

            <SubscribeButton />

            <p className="mt-3 font-body text-[12px] text-warm-taupe text-center">
              Du kan opsige når som helst. Ingen binding.
            </p>
          </div>

          {/* VM-tryout-boks (vises kun under aktiv kampagne) */}
          {freeEventName && (
            <div className="bg-forest border border-forest rounded-sm p-7 lg:p-8 flex flex-col text-cream">
              <span className="font-condensed font-semibold text-[10px] uppercase tracking-[0.18em] text-gold">
                Lige nu · gratis under VM
              </span>
              <h2 className="mt-3 font-display font-black text-cream text-[26px] lg:text-[32px] leading-tight">
                Prøv det først.{' '}
                <em className="not-italic italic text-gold">Det koster ingenting.</em>
              </h2>

              <p className="mt-5 font-body text-[14px] lg:text-[15px] text-cream/85 leading-relaxed">
                VM 2026 er gratis at spille hele turneringen igennem. Lav et
                spilrum, inviter vennegruppen og forudsig alle 104 kampe. Når
                VM er slut kan du blive medlem hvis du vil have cykling, Premier
                League og resten med.
              </p>

              <ul className="mt-5 space-y-2 text-[13px] text-cream/80">
                <li className="flex items-baseline gap-2">
                  <span className="text-gold">·</span>
                  <span>Ingen betaling, ingen kreditkort</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-gold">·</span>
                  <span>Alle 104 kampe med live-data</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-gold">·</span>
                  <span>Spilrum med dine venner</span>
                </li>
              </ul>

              <div className="mt-auto pt-8">
                <Link
                  href="/games/fodbold/new"
                  className="inline-flex w-full items-center justify-center px-6 py-3.5 rounded-sm bg-gold text-forest font-condensed font-bold text-[13px] uppercase tracking-[0.08em] hover:opacity-90 transition-opacity"
                >
                  Opret VM-spilrum →
                </Link>
                <p className="mt-3 font-body text-[12px] text-cream/55 text-center">
                  Bliv medlem når du har lyst. Ingen tidspres.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sekundære links */}
        <p className="mt-10 font-body text-[13px] text-warm-gray text-center">
          <Link href="/logout" className="underline hover:text-forest transition-colors">
            Log ud
          </Link>
          {' · '}
          <Link href="/profile" className="underline hover:text-forest transition-colors">
            Tilbage til profil
          </Link>
        </p>
      </div>
    </div>
  )
}
