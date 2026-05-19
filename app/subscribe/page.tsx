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
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center">
          {/* Left: editorial */}
          <div>
            <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
              Én pris · ingen profit
            </span>

            <h1 className="mt-4 font-display font-black text-forest text-[40px] lg:text-[56px] leading-[0.95]">
              Bliv medlem af klubben.
              <br />
              <em className="not-italic text-gold-dark italic">Spil mod vennerne.</em>
            </h1>

            <p className="mt-6 font-body text-[16px] text-warm-gray leading-relaxed max-w-[460px]">
              Din krone går til licenser på live etape-resultater, kamp-data og
              statistik fra 20 europæiske ligaer. Ingen rigtige penge i spil.
              Kun ære og prestige.
            </p>

            {canceled === '1' && (
              <div
                className="mt-6 p-4 rounded-sm border max-w-[460px]"
                style={{ background: 'rgba(200,57,43,0.08)', borderColor: 'rgba(200,57,43,0.3)' }}
              >
                <p className="font-body text-sm text-ink">
                  Du afbrød checkout. Ingen betaling er gennemført.
                </p>
              </div>
            )}

            <div className="mt-10">
              <SubscribeButton />
            </div>

            <p className="mt-4 font-body text-[12px] text-warm-taupe">
              Du kan opsige når som helst. Ingen binding.
            </p>

            <p className="mt-6 font-body text-[13px] text-warm-gray">
              <Link href="/logout" className="underline hover:text-forest transition-colors">
                Log ud
              </Link>
              {' · '}
              <Link href="/profile" className="underline hover:text-forest transition-colors">
                Tilbage til profil
              </Link>
            </p>
          </div>

          {/* Right: vintage receipt */}
          <div
            className="relative bg-cream-dark border-y border-dashed border-warm-border p-7 lg:p-8"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            <div className="text-center">
              <div className="font-condensed font-semibold text-[10px] uppercase tracking-[0.2em] text-warm-taupe">
                Bodega Bets · Sæson 25/26
              </div>
              <div className="mt-1 font-condensed text-[10px] uppercase tracking-[0.14em] text-warm-taupe/70">
                Medlemskab · månedlig
              </div>
            </div>

            <div className="my-5 border-t border-dashed border-warm-border" />

            <ul className="space-y-2.5 text-[12px] text-ink">
              {RECEIPT_LINES.map((line) => (
                <li
                  key={line.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate">{line.label}</span>
                  <span
                    className="flex-shrink-0 text-warm-taupe text-[11px] uppercase tracking-[0.08em]"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {line.value}
                  </span>
                </li>
              ))}
            </ul>

            <div className="my-5 border-t border-dashed border-warm-border" />

            <div className="flex items-baseline justify-between">
              <span className="font-condensed font-bold text-[12px] uppercase tracking-[0.14em] text-forest">
                Total
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-display font-black text-forest text-[34px] leading-none">
                  €1.00
                </span>
                <span className="text-[11px] text-warm-taupe uppercase tracking-[0.08em]">
                  /måned
                </span>
              </span>
            </div>

            <div className="my-5 border-t border-dashed border-warm-border" />

            <p className="text-center text-[10px] uppercase tracking-[0.14em] text-warm-taupe/80">
              tak fordi du spiller med
            </p>
          </div>
        </div>

        {/* VM-tryout sektion — vises kun under aktiv free-event-kampagne */}
        {freeEventName && (
          <div className="mt-20 lg:mt-28">
            <div className="flex items-center max-w-3xl mx-auto mb-10">
              <div className="flex-1 border-t border-warm-border" />
              <span className="px-5 font-condensed text-[11px] uppercase tracking-[0.18em] text-warm-taupe">
                Eller
              </span>
              <div className="flex-1 border-t border-warm-border" />
            </div>

            <div className="max-w-3xl mx-auto bg-cream-dark border border-warm-border rounded-sm p-7 lg:p-10">
              <span className="font-condensed font-semibold text-[11px] uppercase tracking-[0.14em] text-gold-dark">
                Lige nu · gratis under VM
              </span>
              <h2 className="mt-3 font-display font-black text-forest text-[28px] lg:text-[36px] leading-[1.05]">
                Prøv det først. Det koster ingenting.
              </h2>
              <p className="mt-5 font-body text-[15px] lg:text-[16px] text-warm-gray leading-relaxed max-w-[560px]">
                VM 2026 er gratis at spille hele turneringen igennem. Lav et
                spilrum, inviter vennegruppen og forudsig alle 104 kampe. Når
                VM er slut kan du blive medlem hvis du vil have cykling, Premier
                League og resten med.
              </p>
              <p className="mt-4 font-body text-[14px] text-warm-taupe">
                Ingen betaling. Ingen kreditkort. Bare opret et spilrum og spil.
              </p>
              <Link
                href="/games/fodbold/new"
                className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-sm border border-forest text-forest font-condensed font-bold text-xs uppercase tracking-[0.08em] hover:bg-forest hover:text-cream transition-colors"
              >
                Opret VM-spilrum →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
