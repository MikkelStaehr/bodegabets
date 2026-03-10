import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import FootballIcon from '@/components/icons/FootballIcon'
import TargetIcon from '@/components/icons/TargetIcon'
import TrophyIcon from '@/components/icons/TrophyIcon'
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
    .limit(20)

  const ranked = assignRanks((profiles as Profile[]) ?? [])
  const currentUserRank = user ? ranked.find((p) => p.id === user.id) ?? null : null

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Hero (mørk grøn) ─────────────────────────────────── */}
      <header className="bg-forest">
        <div className="max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">
          {/* Sæson-badge */}
          <div className="inline-flex items-center gap-2 border border-forest-light text-cream/70 font-condensed text-xs uppercase tracking-[0.12em] px-3 py-1.5 rounded-[4px] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            VM 2026 — Aktiv sæson
          </div>

          <h1 className="font-display text-cream text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5">
            Spil mod vennerne.<br />
            <span className="text-gold">Ingen rigtige penge.</span>
          </h1>

          <p className="font-body text-cream/70 text-lg max-w-md mx-auto mb-10 leading-relaxed">
            Opret private spilrum, afgiv bets på fodboldkampe og kæmp om point og prestige.
          </p>

          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-cream text-forest font-condensed font-700 text-base uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-90 transition-opacity"
            >
              Gå til dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-cream text-forest font-condensed font-700 text-base uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:opacity-90 transition-opacity"
              >
                Opret profil gratis
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-transparent border-[1.5px] border-cream/40 text-cream font-condensed font-600 text-base uppercase tracking-[0.08em] px-8 py-4 rounded-sm hover:border-cream/80 transition-colors"
              >
                Log ind
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ── Features strip ───────────────────────────────────── */}
      <section className="border-b border-warm-border">
        <div className="max-w-4xl mx-auto px-4 py-0 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-warm-border">
          {[
            {
              Icon: FootballIcon,
              title: 'Private spilrum',
              desc: 'Opret eller join et spil via en 6-tegns invitationskode',
            },
            {
              Icon: TargetIcon,
              title: '1-X-2 + side-bets',
              desc: 'Bet på kampresultater, topscorer, kort og mere',
            },
            {
              Icon: TrophyIcon,
              title: 'Leaderboard',
              desc: 'Følg din placering lokalt og globalt i realtid',
            },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="bg-cream px-8 py-8" style={{ padding: '32px' }}>
              <Icon className="w-6 h-6 mb-5 text-warm-gray" />
              <h3 className="font-condensed font-700 text-ink text-sm uppercase tracking-[0.08em] mb-2">
                {title}
              </h3>
              <p className="font-body text-warm-gray leading-relaxed" style={{ fontSize: '14px' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Globalt leaderboard ──────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-16">

        {/* Sektion-header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-condensed uppercase text-warm-gray mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Platform</p>
            <h2 className="font-display text-ink font-bold" style={{ fontSize: '28px' }}>Globalt leaderboard</h2>
          </div>
          {ranked.length > 0 && (
            <span className="font-condensed text-warm-gray text-sm">
              {ranked.length} spillere
            </span>
          )}
        </div>

        {ranked.length === 0 ? (
          <div className="bg-cream-dark border border-warm-border rounded-sm p-14 text-center">
            <p className="font-body text-warm-gray text-sm">
              Ingen spillere endnu — vær den første!
            </p>
          </div>
        ) : (
          <div className="border border-warm-border rounded-sm overflow-hidden bg-cream">

            {/* Tabel-header */}
            <div className="grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[3rem_1fr_auto] items-center px-4 sm:px-5 py-3 bg-cream-dark border-b border-warm-border">
              <span className="label-caps text-warm-gray">#</span>
              <span className="label-caps text-warm-gray">Spiller</span>
              <span className="label-caps text-warm-gray">Point</span>
            </div>

            {/* Rækker */}
            <ul>
              {ranked.map((profile, index) => {
                const isCurrentUser = user?.id === profile.id

                return (
                  <li
                    key={profile.id}
                    className={[
                      'grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[3rem_1fr_auto] items-center px-4 sm:px-5 py-3 sm:py-4',
                      index < ranked.length - 1 ? 'border-b border-warm-border' : '',
                      isCurrentUser
                        ? 'bg-forest border-l-2 border-l-gold'
                        : 'hover:bg-cream-dark/60',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {/* Placering */}
                    <span
                      className={[
                        'stat-number text-sm w-8 text-center',
                        profile.rank === 1
                          ? 'text-gold'
                          : profile.rank <= 3
                          ? isCurrentUser ? 'text-cream/80' : 'text-warm-gray'
                          : isCurrentUser ? 'text-cream/50' : 'text-warm-gray',
                      ].join(' ')}
                    >
                      {profile.rank}
                    </span>

                    {/* Brugernavn */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 flex items-center justify-center text-xs font-condensed font-700 shrink-0 rounded-sm ${
                          isCurrentUser
                            ? 'bg-forest-light text-gold'
                            : 'bg-cream-dark text-warm-gray border border-warm-border'
                        }`}
                      >
                        {profile.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`font-body text-sm font-500 truncate block ${
                            isCurrentUser ? 'text-cream' : 'text-ink'
                          }`}
                        >
                          {profile.username}
                        </span>
                        {isCurrentUser && (
                          <span className="label-caps text-gold/70" style={{ fontSize: 9 }}>dig</span>
                        )}
                      </div>
                    </div>

                    {/* Point */}
                    <span
                      className={`stat-number text-base ${
                        isCurrentUser
                          ? profile.rank === 1 ? 'text-gold' : 'text-cream'
                          : profile.rank === 1 ? 'text-gold' : 'text-ink'
                      }`}
                    >
                      {profile.points.toLocaleString('da-DK')}
                    </span>
                  </li>
                )
              })}
            </ul>

            {/* Ikke i top 20 */}
            {user && !currentUserRank && (
              <div className="border-t border-warm-border px-5 py-4 bg-cream-dark">
                <p className="font-body text-warm-gray text-sm text-center">
                  Du er ikke i top 20 endnu — join et spil og optjen point!
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
