import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

/** POST /api/admin/sidebet-options — stub (match_sidebet_options table removed) */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  return NextResponse.json({ error: 'Side-bet options er fjernet' }, { status: 410 })
}

/** DELETE /api/admin/sidebet-options — stub (match_sidebet_options table removed) */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  return NextResponse.json({ error: 'Side-bet options er fjernet' }, { status: 410 })
}
