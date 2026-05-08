import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import GameTicker from '@/components/games/GameTicker'
import RotatingWord from '@/components/layout/RotatingWord'
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

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, username, points')
    .order('points', { ascending: false })
    .limit(10)

  const { data: tickerMatches } = await supabase
    .from('matches')
    .select('home_team, away_team, home_score, away_score, match_date, round:rounds!inner(status, betting_closes_at)')
    .eq('rounds.status', 'finished')
    .order('match_date', { ascending: false })
    .limit(20)

  // Shuffle (Fisher-Yates)
  const shuffled = [...(tickerMatches ?? [])]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const tickerItems = shuffled.map((m) => {
    const round = m.round as unknown as { betting_closes_at: string | null } | null
    const dateStr = m.match_date
      ? new Date(m.match_date).toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short' })
      : (round?.betting_closes_at
        ? new Date(round.betting_closes_at).toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short' })
        : '')
    return `${m.home_team} ${m.home_score ?? '?'}–${m.away_score ?? '?'} ${m.away_team}${dateStr ? ` · ${dateStr}` : ''}`
  })

  const ranked = assignRanks((profiles as Profile[]) ?? [])

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Ticker + Hero ─────────────────────────────────────── */}
      <div className="-mt-14 bg-forest">
        <div className="pt-14">
          {tickerItems.length > 0 && <GameTicker items={tickerItems} />}
        </div>

        <header className="relative overflow-hidden min-h-screen">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 flex items-center min-h-screen">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full py-20">

              {/* Left — copy */}
              <div className="animate-fadeUp text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
                  <span className="block w-8 h-[2px] bg-gold" />
                  <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
                    Privat sport-betting
                  </span>
                </div>

                <h1 className="mb-8">
                  <span className="block font-condensed text-cream uppercase leading-[0.95] font-[800] text-[clamp(56px,8vw,88px)]">
                    Spil mod
                  </span>
                  <span className="block font-display italic text-gold leading-[1.05] font-[900] text-[clamp(60px,8.5vw,96px)]">
                    <RotatingWord />
                  </span>
                </h1>

                <p className="font-body text-cream/50 text-lg max-w-md mx-auto lg:mx-0 mb-2 leading-relaxed font-medium">
                  Ingen rigtige penge. Al prestige.
                </p>
                <p className="font-body text-cream/40 text-base max-w-md mx-auto lg:mx-0 mb-10 leading-relaxed">
                  Opret private spilrum, afgiv bets på sportskampe og kæmp om point og ære med vennerne.
                </p>

                {/* CTAs */}
                {user ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 bg-cream text-forest font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-85 transition-opacity font-bold text-[15px]"
                  >
                    Gå til dashboard
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                    <Link
                      href="/register"
                      className="inline-flex items-center justify-center gap-2 bg-cream text-forest font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-85 transition-opacity font-bold text-[15px]"
                    >
                      Opret profil gratis
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center bg-transparent border-[1.5px] border-cream/30 text-cream font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:border-cream/60 transition-colors font-semibold text-[15px]"
                    >
                      Log ind
                    </Link>
                  </div>
                )}

                {/* Pills */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-10 justify-center lg:justify-start">
                  {['Sport & ligaer', 'Konsensus-odds', 'Live resultater', 'Gratis'].map((pill) => (
                    <span
                      key={pill}
                      className="font-condensed text-xs uppercase tracking-[0.08em] text-cream/50 border border-cream/15 px-3 py-1.5 rounded-full font-semibold"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right — coupon mockup (hidden on mobile) */}
              <div className="hidden lg:flex justify-center animate-fadeUp" style={{ animationDelay: '0.2s' }}>
                <div
                  className="w-[340px] rounded-sm overflow-hidden transition-transform duration-500 hover:rotate-0 bg-cream shadow-2xl"
                  style={{ transform: 'rotate(5deg)' }}
                >
                  {/* Coupon header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-forest">
                    <span className="font-condensed text-cream text-sm uppercase tracking-[0.08em] font-bold">
                      Min kupon
                    </span>
                    <span className="font-condensed text-xs uppercase tracking-[0.08em] px-2.5 py-0.5 rounded-full font-bold bg-gold/20 text-gold">
                      Aktiv
                    </span>
                  </div>

                  {/* Matches */}
                  <div className="divide-y divide-ink/[0.06]">
                    {[
                      { home: 'Liverpool', away: 'Man United', selected: '1', correct: 'X' },
                      { home: 'Real Madrid', away: 'Barcelona', selected: null, correct: null },
                      { home: 'PSG', away: 'Marseille', selected: null, correct: null },
                    ].map((match, i) => (
                      <div key={i} className="px-5 py-3.5">
                        <p className="font-body text-xs text-ink/60 mb-2">
                          {match.home} – {match.away}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {['1', 'X', '2'].map((opt) => {
                            const isSelected = match.selected === opt
                            const isCorrect = match.correct === opt
                            return (
                              <div
                                key={opt}
                                className={[
                                  'font-condensed text-center text-sm py-2 rounded-sm font-bold border-2',
                                  isSelected
                                    ? 'bg-forest text-cream border-transparent'
                                    : 'bg-cream-dark text-warm-gray border-transparent',
                                  isCorrect ? 'border-gold' : '',
                                ].join(' ')}
                              >
                                {opt}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Coupon footer */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-ink/[0.06]">
                    <span className="font-body text-sm text-ink/60">300 pt indsats</span>
                    <span className="font-condensed text-xs uppercase tracking-[0.08em] px-4 py-2 rounded-sm cursor-pointer font-bold bg-gold text-forest">
                      Lås valg
                      <svg className="w-3 h-3 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* ── Sådan virker det ──────────────────────────────────── */}
      <section className="bg-cream">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-24">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-[2px] bg-gold" />
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
              Kom i gang
            </span>
          </div>
          <h2 className="font-display italic text-ink mb-16 font-bold text-[clamp(28px,4vw,40px)]">
            På 2 minutter er du klar.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6 relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-[2px] bg-gold/15" />

            {[
              { step: 1, title: 'Opret profil', desc: 'Tilmeld dig gratis med e-mail' },
              { step: 2, title: 'Join et spilrum', desc: 'Brug en 6-tegns invitationskode' },
              { step: 3, title: 'Afgiv dine bets', desc: 'Vælg udfald inden deadline' },
              { step: 4, title: 'Høst prestige', desc: 'Følg med live og kæmp om førstepladsen' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col relative">
                <span className="font-display italic text-gold/25 leading-none mb-4 font-[900] text-[72px]">
                  {step}
                </span>
                <h3 className="font-condensed text-ink text-sm uppercase tracking-[0.08em] mb-2 font-bold">
                  {title}
                </h3>
                <p className="font-body text-warm-gray text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
