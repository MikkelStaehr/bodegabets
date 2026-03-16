import { NextResponse } from 'next/server'

export function requireCronAuth(authHeader: string | null): NextResponse | null {
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
