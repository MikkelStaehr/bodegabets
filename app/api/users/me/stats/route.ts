import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const betsRes = await supabaseAdmin
    .from('bets')
    .select('result')
    .eq('user_id', user.id)
  const bets = betsRes.data ?? []

  const totalBets = bets.filter(b => b.result !== null).length
  const correctBets = bets.filter(b => b.result === 'win').length
  const precision = totalBets > 0 ? Math.round((correctBets / totalBets) * 100) : 0

  // Bedste placering: hent alle game_members for brugerens spil og find laveste earnings-rang
  // Simplificeret: brug profiles.points som proxy — returner bare tallene vi har
  return NextResponse.json({
    totalBets,
    correctBets,
    precision,
  })
}
