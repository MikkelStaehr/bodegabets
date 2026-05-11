import { supabaseAdmin } from '@/lib/supabase'
import { createServerSupabaseClient } from '@/lib/supabase'
import AdminTabClient from '@/components/admin/AdminTabClient'
import { TournamentRow, SeasonRow } from '@/components/admin/LeagueHubClient'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', user!.id)
    .single()

  const [
    { data: tournamentsData },
    { data: lastSyncData },
  ] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select(`
        id, name, logo_url,
        seasons (
          id, bold_phase_id,
          match_count:matches(count)
        )
      `)
      .order('name'),

    supabaseAdmin
      .from('admin_logs')
      .select('created_at')
      .eq('action', 'batch-sync')
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const tournaments: TournamentRow[] = (tournamentsData ?? []).map((t) => {
    const rawSeasons = (t.seasons ?? []) as unknown as Array<{
      id: number
      bold_phase_id: number | null
      match_count: { count: number }[]
    }>
    const seasons: SeasonRow[] = rawSeasons.map((s) => ({
      id: s.id,
      bold_phase_id: s.bold_phase_id,
      match_count: (s.match_count as unknown as { count: number }[])?.[0]?.count ?? 0,
    }))
    return {
      id: t.id as number,
      name: t.name as string,
      logo_url: (t.logo_url as string | null) ?? null,
      seasons,
    }
  })

  const lastSync = lastSyncData?.[0]?.created_at ?? null


  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <p className="font-condensed uppercase text-[#7a7060] mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
          Internt
        </p>
        <h1 className="font-['Playfair_Display'] text-[#1a3329] font-bold mb-6 text-[24px] sm:text-[28px]">
          Admin panel
        </h1>

        <AdminTabClient
          tournaments={tournaments}
          lastSync={lastSync}
        />
      </div>
    </div>
  )
}
