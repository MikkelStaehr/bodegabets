/**
 * MANUEL FALLBACK — køres ikke automatisk.
 * Railway (railway/index.ts) er den primære cron-kilde via node-cron (dagligt 10:00 UTC).
 * Kan trigges manuelt via POST /api/admin/run-cron { cron: 'send-reminders' }.
 */

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cronAuth'

function getWebPush() {
  webpush.setVapidDetails(
    'mailto:admin@bodegabets.dk',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  return webpush
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers.get('authorization'))
  if (authError) return authError

  const now = new Date()
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000)

  // Find rounds with deadline within next 6 hours
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, season_id, betting_closes_at')
    .neq('status', 'finished')
    .gt('betting_closes_at', now.toISOString())
    .lte('betting_closes_at', sixHoursLater.toISOString())

  if (!rounds?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No upcoming deadlines' })
  }

  let totalSent = 0
  let totalFailed = 0

  for (const round of rounds) {
    const hoursLeft = Math.round(
      (new Date(round.betting_closes_at!).getTime() - now.getTime()) / (1000 * 60 * 60)
    )

    // Find games using this season via game_seasons junction table
    const { data: gameSeasonRows } = await supabaseAdmin
      .from('game_seasons')
      .select('game_id')
      .eq('season_id', round.season_id)

    const gameIdsForSeason = (gameSeasonRows ?? []).map((g: { game_id: number }) => g.game_id)
    const { data: games } = gameIdsForSeason.length
      ? await supabaseAdmin
          .from('games')
          .select('id, name')
          .in('id', gameIdsForSeason)
      : { data: [] as { id: number; name: string }[] }

    if (!games?.length) continue

    for (const game of games) {
      // Find members who have NOT placed bets in this round
      const { data: members } = await supabaseAdmin
        .from('game_members')
        .select('user_id')
        .eq('game_id', game.id)

      if (!members?.length) continue

      const memberUserIds = members.map((m) => m.user_id)

      // Find who already placed bets
      const { data: existingBets } = await supabaseAdmin
        .from('bets')
        .select('user_id')
        .eq('round_id', round.id)
        .in('user_id', memberUserIds)

      const betUserIds = new Set((existingBets ?? []).map((b) => b.user_id))
      const missingUserIds = memberUserIds.filter((uid) => !betUserIds.has(uid))

      if (!missingUserIds.length) continue

      // Get push subscriptions for these users
      const { data: subscriptions } = await supabaseAdmin
        .from('push_subscriptions')
        .select('subscription')
        .in('user_id', missingUserIds)

      if (!subscriptions?.length) continue

      const payload = JSON.stringify({
        title: '⏰ Bodega Bets',
        body: `Deadline om ${hoursLeft} timer — ${game.name} venter!`,
        url: `/games/${game.id}`,
      })

      for (const sub of subscriptions) {
        try {
          await getWebPush().sendNotification(
            sub.subscription as webpush.PushSubscription,
            payload
          )
          totalSent++
        } catch (err: unknown) {
          totalFailed++
          // Remove expired subscriptions (410 Gone)
          if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', (sub.subscription as { endpoint: string }).endpoint)
          }
        }
      }
    }
  }

  await supabaseAdmin
    .from('admin_logs')
    .insert({
      type: 'send_reminders',
      status: totalSent > 0 ? 'success' : 'info',
      message: `send-reminders: ${totalSent} sent, ${totalFailed} failed`,
      metadata: { sent: totalSent, failed: totalFailed, rounds: rounds.length },
    })

  return NextResponse.json({ ok: true, sent: totalSent, failed: totalFailed })
}
