import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { runLeagueSync } from '@/lib/syncLeagueMatches'

export const maxDuration = 60

/**
 * Manuelt trigger af fixture-sync (ingen CRON_SECRET).
 * Kun til lokal/admin-brug — kald IKKE fra Vercel cron.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const results = await runLeagueSync()
  return NextResponse.json({ results })
}
