import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import Badge from '@/components/ui/Badge'
import LogoutButton from '@/components/LogoutButton'
import type { Game } from '@/types'

type MembershipRow = {
  points: number
  joined_at: string
  game: Game & { member_count: number }
}

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: memberships },
    { data: allProfiles },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, points, is_admin, created_at')
      .eq('id', user.id)
      .single(),

    supabase
      .from('game_members')
      .select(`
        points,
        joined_at,
        game:games (
          id, name, description, status, invite_code, created_at,
          member_count:game_members(count)
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),

    supabase
      .from('profiles')
      .select('id, points')
      .order('points', { ascending: false }),
  ])

  const games: MembershipRow[] = ((memberships ?? []) as unknown as MembershipRow[]).filter(
    (m) => m.game !== null
  )

  const activeGames = games.filter((g) => g.game.status === 'active').length

  // Beregn global rang
  const sortedProfiles = (allProfiles ?? [])
  let globalRank: number | null = null
  for (let i = 0; i < sortedProfiles.length; i++) {
    if (sortedProfiles[i].id === user.id) {
      // Find delt rang
      const myPoints = sortedProfiles[i].points
      const rank = sortedProfiles.findIndex((p) => p.points === myPoints) + 1
      globalRank = rank
      break
    }
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('da-DK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* ── Profil header ─────────────────────────────────── */}
        <section>
          <p className="font-condensed uppercase text-warm-gray mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Konto</p>
          <h1 className="font-display text-ink font-bold mb-4" style={{ fontSize: '28px' }}>
            {profile?.username ?? '—'}
          </h1>
          <p className="font-body text-warm-gray text-sm">
            Medlem siden {memberSince}
          </p>
        </section>

        <hr className="border-warm-border" />

        {/* ── Point oversigt ────────────────────────────────── */}
        <section>
          <p className="font-condensed uppercase text-warm-gray mb-4" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Point oversigt</p>
          <div className="grid grid-cols-3 divide-x divide-warm-border border border-warm-border bg-cream-dark">
            <StatBox label="Globale PT" value={(profile?.points ?? 0).toLocaleString('da-DK')} />
            <StatBox label="Aktive spil" value={String(activeGames)} />
            <StatBox label="Global rang" value={globalRank ? `#${globalRank}` : '—'} />
          </div>
        </section>

        <hr className="border-warm-border" />

        {/* ── Mine spilrum ──────────────────────────────────── */}
        <section>
          <p className="font-condensed uppercase text-warm-gray mb-4" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Mine spilrum</p>

          {games.length === 0 ? (
            <div className="border border-warm-border bg-cream-dark p-10 text-center">
              <p className="font-body text-warm-gray text-sm">Du er ikke med i nogen spilrum endnu.</p>
              <Link
                href="/dashboard"
                className="inline-block mt-4 font-condensed text-xs uppercase tracking-[0.08em] text-forest hover:opacity-70 transition-opacity"
              >
                Gå til dashboard →
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {games.map(({ game, points }) => (
                <li key={game.id}>
                  <Link
                    href={`/games/${game.id}`}
                    className="flex items-center justify-between gap-4 border border-warm-border bg-cream-dark px-5 py-4 hover:bg-cream transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-condensed font-bold text-ink text-base uppercase tracking-wide truncate">
                          {game.name}
                        </span>
                        <Badge status={game.status === 'active' ? 'active' : 'finished'} />
                      </div>
                      <span className="font-body text-warm-gray text-xs">
                        {(game.member_count as unknown as { count: number }).count ?? 0} deltagere
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-condensed font-bold text-ink text-lg">
                        {points.toLocaleString('da-DK')}
                      </div>
                      <div className="font-condensed text-warm-gray uppercase tracking-wide" style={{ fontSize: '10px' }}>lokale pt</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <hr className="border-warm-border" />

        {/* ── Konto ─────────────────────────────────────────── */}
        <section>
          <p className="font-condensed uppercase text-warm-gray mb-4" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>Konto</p>
          <div className="border border-warm-border bg-cream-dark p-5 space-y-4">
            <div>
              <label className="font-condensed text-xs uppercase tracking-[0.08em] text-warm-gray block mb-1">
                Email
              </label>
              <p className="font-body text-ink text-sm">{user.email}</p>
            </div>
            <div className="pt-2 border-t border-warm-border">
              <LogoutButton />
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-5 text-center">
      <div className="font-condensed font-bold text-ink text-2xl mb-1">{value}</div>
      <div className="font-condensed uppercase text-warm-gray" style={{ fontSize: '10px', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
