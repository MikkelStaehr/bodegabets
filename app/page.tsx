import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import LandingTicker from '@/components/landing/LandingTicker'
import HeroRotator from '@/app/(marketing)/landing-v2/HeroRotator'
import PriceSection from '@/components/landing/PriceSection'
import ChampionshipSection from '@/components/landing/ChampionshipSection'
import ProductsSection from '@/components/landing/ProductsSection'
import WorldCupBanner from '@/components/landing/WorldCupBanner'
import { getActiveUserCount, getLandingTickerItems } from '@/lib/landingData'
import type { Profile } from '@/types'

function assignRanks(profiles: Profile[]): (Profile & { rank: number })[] {
  return profiles.map((profile, index, arr) => {
    const rank =
      index === 0
        ? 1
        : profile.points === arr[index - 1].points
        ? (arr[index - 1] as Profile & { rank: number }).rank
        : index + 1
    return { ...profile, rank }
  })
}

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: { user } }, activeUserCount, ticker, freeEventSeason] = await Promise.all([
    supabase.auth.getUser(),
    getActiveUserCount(),
    getLandingTickerItems(),
    // Hent en aktiv free-event sæson (typisk VM 2026). Viser tryout-banneret
    // når den findes — uafhængigt af om der allerede er oprettet spilrum.
    supabase
      .from('seasons')
      .select('id, name, tournaments:tournament_id(name)')
      .eq('is_free_event', true)
      .limit(1)
      .maybeSingle()
      .then((r) => r.data as unknown as { id: number; name: string; tournaments: { name: string } | { name: string }[] | null } | null),
  ])
  const freeEventTournament = freeEventSeason?.tournaments
  const freeEventTournamentName = Array.isArray(freeEventTournament)
    ? freeEventTournament[0]?.name
    : freeEventTournament?.name
  const freeEventName = freeEventSeason
    ? (freeEventTournamentName ?? freeEventSeason.name)
    : null

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, username, points')
    .order('points', { ascending: false })
    .limit(10)

  const ranked = assignRanks((profiles as Profile[]) ?? [])

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Hero + Ticker ─────────────────────────────────────── */}
      <div className="-mt-14 bg-forest">
        <div className="pt-14" />

        {/* Hero (rotating slides + interactive sport-tabs).
            Genbruger den allerede mobil-auditerede komponent fra /landing-v2.
            CTAs peger til /games/new — fungerer for både logged-in og anonyme. */}
        <HeroRotator activeUserCount={activeUserCount} />

        {/* Gold divider + live nyhedsbjælke (matcher /landing-v2-layout) */}
        <div className="h-[3px] bg-gold" />
        {ticker.items.length > 0 && (
          <LandingTicker items={ticker.items} currentDate={ticker.currentDate} />
        )}
      </div>

      {/* ── Free-event banner (vises kun hvis aktiv free-event-sæson) ── */}
      {freeEventName && <WorldCupBanner eventName={freeEventName} />}

      {/* ── Pris-afsnit (€1/mnd bodega-receipt) ─────────────── */}
      <PriceSection />

      {/* ── Bodega Championship (flagship) ──────────────────── */}
      <ChampionshipSection />

      {/* ── De to formater (magazine-cover product cards) ──── */}
      <ProductsSection />

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="bg-forest-light">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

            {/* Left */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="block w-6 h-[2px] bg-gold" />
                <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
                  Pointsystem
                </span>
              </div>
              <h2 className="text-cream mb-6 text-[clamp(28px,4vw,40px)] leading-[1.15]">
                <span className="font-condensed block uppercase font-[800]">Ikke bare</span>
                <span className="font-display italic text-gold font-bold">1-X-2.</span>
              </h2>
              <p className="font-body text-cream/50 text-base leading-relaxed max-w-sm">
                Vores pointsystem belønner modige tips. Jo sjældnere dit valg, jo flere point kan du score — og med streaks, side-bets og wildcards er der altid nye måder at komme foran.
              </p>
            </div>

            {/* Right — feature list */}
            <div className="space-y-6">
              {[
                { title: 'Konsensus-odds', desc: 'Jo sjældnere dit valg, jo højere din potentielle gevinst — op til ×1.8' },
                { title: 'Ekstra bets', desc: 'Bet på clean sheet, scorer 3+ mål eller vindermarginal på hver kamp' },
                { title: 'Rivalry multiplier', desc: 'Store derby-opgør giver automatisk ×1.5 bonus' },
                { title: 'Achievements & øgenavne', desc: 'Optjen hemmelige titler og profilrammer baseret på dine resultater og spillestil' },
                { title: 'Profilrammer', desc: 'Jo mere du vinder, jo mere eksklusiv bliver din profil' },
              ].map(({ title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 bg-gold/15 border-[1.5px] border-gold/40">
                    <svg className="w-3.5 h-3.5 text-gold" viewBox="0 0 14 14" fill="none">
                      <path d="M3.5 7.5L5.5 9.5L10.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-condensed text-cream text-sm uppercase tracking-[0.06em] mb-0.5 font-bold">
                      {title}
                    </p>
                    <p className="font-body text-cream/45 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Leaderboard ───────────────────────────────────────── */}
      <section className="bg-cream-dark">
        <div className="max-w-[640px] mx-auto px-6 lg:px-8 py-12 lg:py-24">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-[2px] bg-gold" />
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
              Platform
            </span>
          </div>
          <h2 className="font-display italic text-ink mb-12 font-bold text-[clamp(28px,4vw,40px)]">
            Globalt leaderboard
          </h2>

          {ranked.length === 0 ? (
            <div className="bg-cream border border-warm-border rounded-sm p-14 text-center">
              <p className="font-body text-warm-gray text-sm">Ingen spillere endnu — vær den første!</p>
            </div>
          ) : (
            <div className="border border-warm-border rounded-sm overflow-hidden bg-cream">
              {/* Table header */}
              <div className="grid grid-cols-[2.5rem_1fr_auto] items-center px-5 py-3 bg-cream-dark border-b border-warm-border">
                <span className="label-caps text-warm-gray">#</span>
                <span className="label-caps text-warm-gray">Spiller</span>
                <span className="label-caps text-warm-gray">Point</span>
              </div>

              <ul>
                {ranked.map((profile, index) => {
                  const isCurrentUser = user?.id === profile.id
                  const rankClasses =
                    profile.rank === 1
                      ? 'text-gold'
                      : profile.rank === 2
                      ? 'text-warm-gray'
                      : profile.rank === 3
                      ? 'text-vintage-red/60'
                      : isCurrentUser
                      ? 'text-cream/50'
                      : 'text-warm-gray'

                  return (
                    <li
                      key={profile.id}
                      className={[
                        'grid grid-cols-[2.5rem_1fr_auto] items-center px-5 py-3.5',
                        index < ranked.length - 1 ? 'border-b border-warm-border' : '',
                        isCurrentUser ? 'bg-forest border-l-2 border-l-gold' : 'hover:bg-cream-dark/60',
                      ].filter(Boolean).join(' ')}
                    >
                      {/* Rank */}
                      <span className={`stat-number text-sm w-8 text-center ${rankClasses}`}>
                        {profile.rank}
                      </span>

                      {/* User */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={[
                            'w-8 h-8 flex items-center justify-center text-xs font-condensed shrink-0 rounded-full font-bold',
                            profile.rank === 1
                              ? 'bg-gold/20 text-gold border-[1.5px] border-gold/40'
                              : isCurrentUser
                              ? 'bg-forest-light text-gold'
                              : 'bg-cream-dark text-warm-gray border border-warm-border',
                          ].join(' ')}
                        >
                          {profile.username[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className={`font-body text-sm font-medium truncate block ${isCurrentUser ? 'text-cream' : 'text-ink'}`}>
                            {profile.username}
                          </span>
                          {isCurrentUser && (
                            <span className="label-caps text-gold/70 text-[9px]">dig</span>
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <span className={`stat-number text-base ${isCurrentUser ? (profile.rank === 1 ? 'text-gold' : 'text-cream') : (profile.rank === 1 ? 'text-gold' : 'text-ink')}`}>
                        {profile.points.toLocaleString('da-DK')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="max-w-[640px] mx-auto px-6 lg:px-8 py-12 lg:py-24">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-[2px] bg-gold" />
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
              FAQ
            </span>
          </div>
          <h2 className="font-display italic text-ink mb-12 font-bold text-[clamp(28px,4vw,40px)]">
            Ofte stillede spørgsmål.
          </h2>

          <div className="flex flex-col divide-y divide-ink/[0.07]">
            {[
              {
                q: 'Er Bodega Bets gratis?',
                a: 'Ja, helt gratis. Der spilles ikke om rigtige penge — kun om prestige og æren af at slå vennerne.',
              },
              {
                q: 'Hvordan joiner jeg et spilrum?',
                a: 'Du skal have en 6-tegns invitationskode fra den der oprettede spilrummet. Opret en profil, gå til dashboard og indtast koden.',
              },
              {
                q: 'Hvad er konsensus-odds?',
                a: 'Jo færre der vælger det samme som dig, jo højere er din potentielle gevinst. Odds beregnes løbende men vises først når bets lukker — så du aldrig ved hvad andre har valgt inden deadline.',
              },
              {
                q: 'Hvornår lukker bets?',
                a: 'Bets lukker automatisk 30 minutter før kampstart. Du kan afgive og ændre dine bets helt frem til da.',
              },
              {
                q: 'Hvad er ekstra bets?',
                a: 'Udover 1/X/2 kan du på hver kamp bette på om et hold scorer 3+ mål, holder clean sheet, eller vinder med 2+ mål. Korrekt ekstra bet giver stake × 2 — men forkert ekstra bet trækkes fra din rundegevinst.',
              },
              {
                q: 'Hvad sker der hvis jeg ikke afgiver bets i en runde?',
                a: 'Du scorer 0 point i den runde. Du kan stadig deltage i næste runde — du mister ikke din plads i spilrummet.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="py-5">
                <p className="font-condensed text-ink text-sm uppercase tracking-[0.06em] mb-2 font-bold">
                  {q}
                </p>
                <p className="font-body text-warm-gray text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      {!user && (
        <section className="relative overflow-hidden bg-forest">
          {/* Radial glow */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/[0.07] to-transparent" />
          <div className="relative max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-28 text-center">
            <h2 className="font-display italic text-cream mb-5 font-[900] text-[clamp(72px,10vw,120px)] leading-none">
              Klar?
            </h2>
            <p className="font-body text-cream/40 text-lg mb-12 max-w-md mx-auto">
              Det koster ingenting. Kun dit venskab.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-cream text-forest font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-85 transition-opacity font-bold text-[15px]"
            >
              Opret profil gratis
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}

    </div>
  )
}
