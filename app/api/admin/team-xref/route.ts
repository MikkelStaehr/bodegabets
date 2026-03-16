import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

/** GET /api/admin/team-xref — stub (team_xref table removed) */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  return NextResponse.json({ leagues: [], groups: [] })
}
