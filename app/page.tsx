import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import GameTicker from '@/components/GameTicker'
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
    .from('profiles')
    .select('id, username, points')
    .order('points', { ascending: false })
    .limit(10)

  // Hent den seneste færdige runde og dens kampe til ticker
  const { data: latestRound } = await supabase
    .from('rounds')
    .select('id, name')
    .eq('status', 'finished')
    .order('betting_closes_at', { ascending: false })
    .limit(1)
    .single()

  const roundId = latestRound?.id
  const roundName = latestRound?.name ?? ''
  const { data: roundMatches } = roundId
    ? await supabase
        .from('matches')
        .select('home_team, away_team, home_score, away_score, kickoff_at')
        .eq('round_id', roundId)
        .order('kickoff_at', { ascending: true })
    : { data: null }

  const tickerItems = (roundMatches ?? []).map((m) =>
    `⚽ ${m.home_team} ${m.home_score ?? '?'}–${m.away_score ?? '?'} ${m.away_team} · ${roundName}`
  )

  const ranked = assignRanks((profiles as Profile[]) ?? [])

  return (
    <div className="min-h-screen bg-cream">

      {/* ── 1. Ticker bar ──────────────────────────────────────── */}
      {tickerItems.length > 0 && <GameTicker items={tickerItems} />}

      {/* ── 2. Hero ────────────────────────────────────────────── */}
      <header className="bg-forest relative overflow-hidden" style={{ minHeight: '100vh' }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex items-center" style={{ minHeight: '100vh' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full py-20">

            {/* Venstre — tekst */}
            <div className="animate-fadeUp text-center lg:text-left">
              {/* Eyebrow */}
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
                <span className="block w-8 h-[2px] bg-gold" />
                <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
                  Privat sport-betting
                </span>
              </div>

              <h1 className="mb-8">
                <span
                  className="block font-condensed text-cream uppercase leading-[0.95]"
                  style={{ fontWeight: 800, fontSize: 'clamp(56px, 8vw, 88px)' }}
                >
                  Spil mod
                </span>
                <span
                  className="block font-display italic text-gold leading-[1.05]"
                  style={{ fontWeight: 900, fontSize: 'clamp(60px, 8.5vw, 96px)' }}
                >
                  vennerne.
                </span>
              </h1>

              <p className="font-body text-cream/50 text-lg max-w-md mx-auto lg:mx-0 mb-2 leading-relaxed" style={{ fontWeight: 500 }}>
                Ingen rigtige penge. Al prestige.
              </p>
              <p className="font-body text-cream/40 text-base max-w-md mx-auto lg:mx-0 mb-10 leading-relaxed">
                Opret private spilrum, afgiv bets på sportskampe og kæmp om point og ære med vennerne.
              </p>

              {/* CTAs */}
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 bg-cream text-forest font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-90 transition-opacity"
                  style={{ fontWeight: 700, fontSize: '15px' }}
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
                    className="inline-flex items-center justify-center gap-2 bg-cream text-forest font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-90 transition-opacity"
                    style={{ fontWeight: 700, fontSize: '15px' }}
                  >
                    Opret profil gratis
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center bg-transparent border-[1.5px] border-cream/30 text-cream font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:border-cream/60 transition-colors"
                    style={{ fontWeight: 600, fontSize: '15px' }}
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
                    className="font-condensed text-xs uppercase tracking-[0.08em] text-cream/50 border border-cream/15 px-3 py-1.5 rounded-full"
                    style={{ fontWeight: 600 }}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Højre — kupon-mockup (skjult på mobil) */}
            <div className="hidden lg:flex justify-center animate-fadeUp" style={{ animationDelay: '0.2s' }}>
              <div
                className="w-[340px] rounded-lg overflow-hidden transition-transform duration-500 hover:rotate-0"
                style={{
                  transform: 'rotate(5deg)',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                  background: '#F2EDE4',
                }}
              >
                {/* Kupon header */}
                <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1a3329' }}>
                  <span className="font-condensed text-cream text-sm uppercase tracking-[0.08em]" style={{ fontWeight: 700 }}>
                    Min kupon
                  </span>
                  <span
                    className="font-condensed text-xs uppercase tracking-[0.08em] px-2.5 py-0.5 rounded-full"
                    style={{ fontWeight: 700, background: 'rgba(184,150,62,0.2)', color: '#B8963E' }}
                  >
                    Aktiv
                  </span>
                </div>

                {/* Kampe */}
                <div className="divide-y divide-black/[0.06]">
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
                              className="font-condensed text-center text-sm py-2 rounded-sm"
                              style={{
                                fontWeight: 700,
                                background: isSelected ? '#1a3329' : '#EDE8DF',
                                color: isSelected ? '#F2EDE4' : '#5C5C4A',
                                border: isCorrect ? '2px solid #B8963E' : '2px solid transparent',
                              }}
                            >
                              {opt}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Kupon footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-black/[0.06]">
                  <span className="font-body text-sm text-ink/60">300 pt indsats</span>
                  <span
                    className="font-condensed text-xs uppercase tracking-[0.08em] px-4 py-2 rounded-sm cursor-pointer"
                    style={{ fontWeight: 700, background: '#B8963E', color: '#1a3329' }}
                  >
                    Lås valg →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 3. Sådan virker det ─────────────────────────────────── */}
      <section className="bg-cream">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-24">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-[2px] bg-gold" />
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
              Kom i gang
            </span>
          </div>
          <h2 className="font-display italic text-ink mb-16" style={{ fontWeight: 700, fontSize: 'clamp(28px, 4vw, 40px)' }}>
            På 2 minutter er du klar.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6 relative">
            {/* Connector-linje */}
            <div
              className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-[2px]"
              style={{ background: 'linear-gradient(to right, #B8963E, #B8963E)', opacity: 0.15 }}
            />

            {[
              { step: 1, title: 'Opret profil', desc: 'Tilmeld dig gratis med e-mail' },
              { step: 2, title: 'Join et spilrum', desc: 'Brug en 6-tegns invitationskode' },
              { step: 3, title: 'Afgiv dine bets', desc: 'Vælg udfald inden deadline' },
              { step: 4, title: 'Høst prestige', desc: 'Følg med live og kæmp om førstepladsen' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col relative">
                <span
                  className="font-display italic text-gold leading-none mb-4"
                  style={{ fontWeight: 900, fontSize: '72px', opacity: 0.25 }}
                >
                  {step}
                </span>
                <h3 className="font-condensed text-ink text-sm uppercase tracking-[0.08em] mb-2" style={{ fontWeight: 700 }}>
                  {title}
                </h3>
                <p className="font-body text-warm-gray text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Features ────────────────────────────────────────── */}
      <section style={{ background: '#2C4A3E' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-start">

            {/* Venstre */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="block w-6 h-[2px] bg-gold" />
                <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
                  Pointsystem
                </span>
              </div>
              <h2 className="text-cream mb-6" style={{ fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.15 }}>
                <span className="font-condensed block uppercase" style={{ fontWeight: 800 }}>Ikke bare</span>
                <span className="font-display italic text-gold" style={{ fontWeight: 700 }}>1-X-2.</span>
              </h2>
              <p className="font-body text-cream/50 text-base leading-relaxed max-w-sm">
                Vores pointsystem belønner modige tips. Jo sjældnere dit valg, jo flere point kan du score — og med streaks, side-bets og wildcards er der altid nye måder at komme foran.
              </p>
            </div>

            {/* Højre — feature liste */}
            <div className="space-y-6">
              {[
                { title: 'Konsensus-odds', desc: 'Sjældne tips giver op til 5× bonus' },
                { title: 'Streak bonus', desc: 'Win 3+ runder i træk for op til 1.5× bonus' },
                { title: 'Ekstra bets', desc: 'BTTS, over/under 2.5, halvleg, målforskel' },
                { title: 'Rivalry multiplier', desc: 'Store derby-opgør giver 1.5× bonus' },
                { title: 'Wildcard runde', desc: 'Admin vælger én kamp med dobbelt point' },
              ].map(({ title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  {/* Gold checkmark circle */}
                  <span
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: 'rgba(184,150,62,0.15)', border: '1.5px solid rgba(184,150,62,0.4)' }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                      <path d="M3.5 7.5L5.5 9.5L10.5 4.5" stroke="#B8963E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-condensed text-cream text-sm uppercase tracking-[0.06em] mb-0.5" style={{ fontWeight: 700 }}>
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

      {/* ── 5. Leaderboard ─────────────────────────────────────── */}
      <section className="bg-cream-dark">
        <div className="max-w-[640px] mx-auto px-6 lg:px-8 py-12 lg:py-24">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-[2px] bg-gold" />
            <span className="font-condensed font-semibold text-xs uppercase tracking-[0.14em] text-gold">
              Platform
            </span>
          </div>
          <h2 className="font-display italic text-ink mb-12" style={{ fontWeight: 700, fontSize: 'clamp(28px, 4vw, 40px)' }}>
            Globalt leaderboard
          </h2>

          {ranked.length === 0 ? (
            <div className="bg-cream border border-warm-border rounded-sm p-14 text-center">
              <p className="font-body text-warm-gray text-sm">Ingen spillere endnu — vær den første!</p>
            </div>
          ) : (
            <div className="border border-warm-border rounded-sm overflow-hidden bg-cream">
              {/* Tabel-header */}
              <div className="grid grid-cols-[2.5rem_1fr_auto] items-center px-5 py-3 bg-cream-dark border-b border-warm-border">
                <span className="label-caps text-warm-gray">#</span>
                <span className="label-caps text-warm-gray">Spiller</span>
                <span className="label-caps text-warm-gray">Point</span>
              </div>

              <ul>
                {ranked.map((profile, index) => {
                  const isCurrentUser = user?.id === profile.id
                  const rankColor =
                    profile.rank === 1
                      ? '#B8963E'
                      : profile.rank === 2
                      ? '#8A9BA8'
                      : profile.rank === 3
                      ? '#A0785A'
                      : undefined

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
                      <span
                        className="stat-number text-sm w-8 text-center"
                        style={{ color: isCurrentUser ? (rankColor ?? 'rgba(242,237,228,0.5)') : (rankColor ?? '#5C5C4A') }}
                      >
                        {profile.rank}
                      </span>

                      {/* User */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 flex items-center justify-center text-xs font-condensed shrink-0 rounded-full"
                          style={{
                            fontWeight: 700,
                            background: profile.rank === 1 ? 'rgba(184,150,62,0.2)' : isCurrentUser ? '#2E5040' : '#EDE8DF',
                            color: profile.rank === 1 ? '#B8963E' : isCurrentUser ? '#B8963E' : '#5C5C4A',
                            border: profile.rank === 1 ? '1.5px solid rgba(184,150,62,0.4)' : isCurrentUser ? 'none' : '1px solid #D4CFC4',
                          }}
                        >
                          {profile.username[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className={`font-body text-sm font-medium truncate block ${isCurrentUser ? 'text-cream' : 'text-ink'}`}>
                            {profile.username}
                          </span>
                          {isCurrentUser && (
                            <span className="label-caps text-gold/70" style={{ fontSize: 9 }}>dig</span>
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <span
                        className="stat-number text-base"
                        style={{ color: isCurrentUser ? (rankColor ?? '#F2EDE4') : (rankColor ?? '#1A1A1A') }}
                      >
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

      {/* ── 6. Final CTA ───────────────────────────────────────── */}
      {!user && (
        <section className="relative overflow-hidden" style={{ background: '#0d1f18' }}>
          {/* Radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(184,150,62,0.07) 0%, transparent 70%)' }}
          />
          <div className="relative max-w-4xl mx-auto px-6 lg:px-8 py-16 lg:py-28 text-center">
            <h2
              className="font-display italic text-cream mb-5"
              style={{ fontWeight: 900, fontSize: 'clamp(72px, 10vw, 120px)', lineHeight: 1 }}
            >
              Klar?
            </h2>
            <p className="font-body text-cream/40 text-lg mb-12 max-w-md mx-auto">
              Det koster ingenting. Kun dit venskab.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-cream text-forest font-condensed uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-90 transition-opacity"
              style={{ fontWeight: 700, fontSize: '15px' }}
            >
              Opret profil gratis
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {/* ── 7. Footer ──────────────────────────────────────────── */}
      <footer className="bg-forest border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 flex items-center justify-between">
          <span className="font-display italic text-cream text-lg" style={{ fontWeight: 700 }}>
            Bodega Bets
          </span>
          <span className="font-body text-cream/30 text-sm">
            © 2026 — Ingen rigtige penge involveret
          </span>
        </div>
      </footer>
    </div>
  )
}
