import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const phaseId = searchParams.get('phase_id')
  const tournamentId = searchParams.get('tournament_id') ?? searchParams.get('league_id')

  if (!phaseId) return NextResponse.json({ error: 'phase_id påkrævet' }, { status: 400 })

  try {
    const boldUrl = `https://api.bold.dk/aggregator/v1/apps/page/matches?phase_ids=${phaseId}&page=1&limit=1000&offset=0`
    const res = await fetch(boldUrl, {
      headers: { 'User-Agent': 'BodegaBets/1.0', 'Accept': 'application/json' },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Bold API fejl: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()

    const matches: any[] = Array.isArray(data) ? data : (data.matches ?? data.data ?? [])

    if (matches.length === 0) {
      return NextResponse.json({ error: 'Ingen kampe fundet for dette phase_id', matches: 0 })
    }

    const dates = matches
      .map((m: any) => m.kickoff ?? m.date ?? m.matchDate ?? m.startDate ?? (m.match?.date ?? m.match?.kickoff))
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime())
      .filter((t: number) => !isNaN(t))
      .sort((a: number, b: number) => a - b)

    const minDate = dates.length ? new Date(dates[0]).toISOString().slice(0, 10) : null
    const maxDate = dates.length ? new Date(dates[dates.length - 1]).toISOString().slice(0, 10) : null

    let currentPhaseId: string | null = null
    if (tournamentId) {
      const { data: season } = await supabaseAdmin
        .from('seasons')
        .select('bold_phase_id')
        .eq('tournament_id', tournamentId)
        .eq('is_active', true)
        .limit(1)
        .single()
      currentPhaseId = season?.bold_phase_id != null ? String(season.bold_phase_id) : null
    }

    return NextResponse.json({
      phase_id: phaseId,
      matches: matches.length,
      min_date: minDate,
      max_date: maxDate,
      current_phase_id: currentPhaseId,
      is_current: currentPhaseId === phaseId,
    })
  } catch (err) {
    return NextResponse.json({ error: `Fejl: ${String(err)}` }, { status: 500 })
  }
}
