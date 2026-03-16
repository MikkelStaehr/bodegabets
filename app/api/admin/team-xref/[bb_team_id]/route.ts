import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

/** PATCH /api/admin/team-xref/[bb_team_id] — stub (team_xref table removed) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bb_team_id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  await params
  return NextResponse.json({ error: 'team_xref er fjernet' }, { status: 410 })
}
