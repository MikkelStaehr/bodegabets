import { NextRequest, NextResponse } from 'next/server'
import { getFixtures, getResults } from '@/lib/boldApi'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const slug = searchParams.get('slug') ?? 'superligaen'

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [fixtures, results] = await Promise.all([
    getFixtures(slug),
    getResults(slug),
  ])

  const fixtureRounds = [...new Set(fixtures.map((f) => f.round || '(ingen runde)'))].sort()
  const resultRounds = [...new Set(results.map((r) => r.round || '(ingen runde)'))].sort()

  return NextResponse.json({
    slug,
    source: 'bold-api',
    fixtures_count: fixtures.length,
    results_count: results.length,
    fixture_rounds: fixtureRounds,
    result_rounds: resultRounds,
    sample_fixture: fixtures[0] ?? null,
    sample_result: results[0] ?? null,
  })
}
