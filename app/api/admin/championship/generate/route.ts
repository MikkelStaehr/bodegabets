import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { generateChampionshipRounds } from '@/lib/generateChampionshipRounds'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const result = await generateChampionshipRounds()
    return NextResponse.json({ ok: true, created: result.created })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ukendt fejl' },
      { status: 500 }
    )
  }
}
