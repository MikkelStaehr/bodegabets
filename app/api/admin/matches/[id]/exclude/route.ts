import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  await params // consume params

  // is_excluded, excluded_reason, excluded_at columns have been removed
  return NextResponse.json(
    { error: 'Match exclusion is no longer supported' },
    { status: 410 }
  )
}
