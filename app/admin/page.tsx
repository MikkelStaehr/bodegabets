import { supabaseAdmin } from '@/lib/supabase'
import { createServerSupabaseClient } from '@/lib/supabase'
import AdminTabClient from '@/components/admin/AdminTabClient'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username, points')
    .eq('id', user!.id)
    .single()

  // Hent ligaer (alle til Liga Hub), spilrum, runder, kampe og sync-logs parallelt
  const [
    { data: leaguesData },
    { data: gamesData },
    { data: roundsData },
    { data: matchesData },
    { data: syncLogsData },
  ] = await Promise.all([
    supabaseAdmin
      .from('leagues')
      .select('id, name, country, bold_slug, fixturedownload_slug, last_synced_at, sync_status, sync_error, total_matches:league_matches(count)')
      .order('name'),

    supabaseAdmin
      .from('games')
      .select(`
        id, name, status, invite_code, created_at,
        league:leagues ( name ),
        member_count:game_members ( count ),
        round_count:rounds ( count )
      `)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('rounds')
      .select(`
        id, name, status, betting_closes_at, league_id,
        league:leagues ( name ),
        match_count:matches ( count )
      `)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('matches')
      .select(`
        id, home_team, away_team, kickoff_at,
        home_score, away_score, status, round_id,
        round:rounds ( name, league:leagues ( name ) ),
        sidebet_options:match_sidebet_options ( id, bet_type )
      `)
      .order('kickoff_at', { ascending: true }),

    supabaseAdmin
      .from('league_sync_logs')
      .select('id, league_id, synced_at, matches_imported, status, message')
      .order('synced_at', { ascending: false })
      .limit(200),
  ])

  // Normalisér games
  const games = (gamesData ?? []).map((g) => {
    const league = g.league as unknown as { name: string } | null
    const memberCount = g.member_count as unknown as { count: number }[]
    const roundCount = g.round_count as unknown as { count: number }[]
    return {
      id:           g.id as number,
      name:         g.name as string,
      status:       g.status as string,
      invite_code:  g.invite_code as string,
      created_at:   g.created_at as string,
      league_name:  league?.name ?? '—',
      member_count: memberCount?.[0]?.count ?? 0,
      round_count:  roundCount?.[0]?.count ?? 0,
    }
  })

  // Normalisér rounds
  const rounds = (roundsData ?? []).map((r) => {
    const league = r.league as unknown as { name: string } | null
    const matchCount = r.match_count as unknown as { count: number }[]
    return {
      id: r.id as number,
      name: r.name as string,
      status: r.status as 'upcoming' | 'open' | 'closed' | 'finished',
      betting_closes_at: r.betting_closes_at as string | null,
      league_id: r.league_id as number,
      game_name: '—',
      league_name: league?.name ?? '—',
      match_count: matchCount?.[0]?.count ?? 0,
    }
  })

  // Normalisér matches
  const matches = (matchesData ?? []).map((m) => {
    const round = m.round as unknown as { name: string; league: { name: string } } | null
    const sidebets = m.sidebet_options as unknown as { id: number; bet_type: string }[]
    return {
      id: m.id as number,
      round_id: m.round_id as number,
      round_name: round?.name ?? '—',
      game_name: round?.league?.name ?? '—',
      home_team: m.home_team as string,
      away_team: m.away_team as string,
      kickoff_at: m.kickoff_at as string | null,
      home_score: m.home_score as number | null,
      away_score: m.away_score as number | null,
      status: m.status as 'scheduled' | 'finished',
      existing_sidebet_types: (sidebets ?? []).map((s) => s.bet_type),
    }
  })

  const adminSecret = process.env.ADMIN_SECRET ?? ''

  const leagues = (leaguesData ?? []).map((l) => ({
    id: l.id as number,
    name: l.name as string,
    country: l.country as string,
    bold_slug: l.bold_slug as string | null,
    fixturedownload_slug: (l as { fixturedownload_slug?: string | null }).fixturedownload_slug ?? null,
    last_synced_at: (l as { last_synced_at?: string }).last_synced_at ?? null,
    sync_status: (l as { sync_status?: string }).sync_status ?? null,
    sync_error: (l as { sync_error?: string }).sync_error ?? null,
    total_matches: (l.total_matches as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))

  const syncLogs = (syncLogsData ?? []).map((log) => ({
    id: log.id as number,
    league_id: log.league_id as number,
    synced_at: log.synced_at as string,
    matches_imported: log.matches_imported as number,
    status: log.status as string,
    message: log.message as string,
  }))

  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <p className="font-condensed uppercase text-[#7a7060] mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
          Internt
        </p>
        <h1 className="font-['Playfair_Display'] text-[#1a3329] font-bold mb-6" style={{ fontSize: '28px' }}>
          Admin panel
        </h1>

        <AdminTabClient
          leagues={leagues}
          syncLogs={syncLogs}
          games={games}
          rounds={rounds}
          matches={matches}
          adminSecret={adminSecret}
        />
      </div>
    </div>
  )
}
