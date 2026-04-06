import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    message:
      'Rider sync skal køres lokalt via Python script: python scripts/cycling/sync_riders.py',
  })
}
