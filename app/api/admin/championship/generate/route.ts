import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { generateChampionshipRounds, ChampionshipSeason } from '@/lib/generateChampionshipRounds'

const VALID_SEASONS: ChampionshipSeason[] = ['2025/26', '2026/27']

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const season = body.season as string

  if (!season || !VALID_SEASONS.includes(season as ChampionshipSeason)) {
    return NextResponse.json({ error: `Ugyldig sæson. Vælg: ${VALID_SEASONS.join(', ')}` }, { status: 400 })
  }

  try {
    const result = await generateChampionshipRounds(season as ChampionshipSeason)
    return NextResponse.json({ ok: true, created: result.created })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ukendt fejl' },
      { status: 500 }
    )
  }
}
