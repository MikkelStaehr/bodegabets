import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const nowIso = now.toISOString()

  // Hent åbne runder (status open/upcoming) med betting_closes_at > now
  const { data: candidateRounds, error: fetchError } = await supabaseAdmin
    .from('rounds')
    .select('id, season_id, betting_closes_at')
    .in('status', ['open', 'upcoming'])
    .gt('betting_closes_at', nowIso)
    .order('betting_closes_at', { ascending: true })

  if (fetchError) {
    await supabaseAdmin.from('admin_logs').insert({
      type: 'update_bet_open',
      status: 'error',
      message: `Fetch rounds failed: ${fetchError.message}`,
    })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Vælg 1 nærmeste runde per season_id
  type CandidateRound = { id: number; season_id: number; betting_closes_at: string }
  const rounds = (candidateRounds ?? []) as CandidateRound[]
  const countBySeason = new Map<number, number>()
  const roundsToProvision: CandidateRound[] = []

  for (const r of rounds) {
    const count = countBySeason.get(r.season_id) ?? 0
    if (count < 1) {
      roundsToProvision.push(r)
      countBySeason.set(r.season_id, count + 1)
    }
  }

  // Opret round_members med 1000 pt for alle spillere i relevante spilrum
  let roundMembersCreated = 0

  for (const round of roundsToProvision) {
    const { data: gameSeasonRows } = await supabaseAdmin
      .from('game_seasons')
      .select('game_id')
      .eq('season_id', round.season_id)

    const gameIds = (gameSeasonRows ?? []).map((gs: { game_id: number }) => gs.game_id)
    if (gameIds.length === 0) continue

    const { data: members } = await supabaseAdmin
      .from('game_members')
      .select('user_id, game_id')
      .in('game_id', gameIds)

    for (const member of members ?? []) {
      await supabaseAdmin
        .from('round_members')
        .upsert(
          {
            user_id: member.user_id,
            round_id: round.id,
            game_id: member.game_id,
            betting_balance: 1000,
          },
          { onConflict: 'user_id,round_id,game_id' }
        )
      roundMembersCreated++
    }
  }

  const provisionedIds = roundsToProvision.map((r) => r.id)
  console.log(`[cron/update-bet-open] ${nowIso} — provisioned ${roundsToProvision.length} runder: [${provisionedIds.join(', ')}], round_members created: ${roundMembersCreated}`)

  await supabaseAdmin.from('admin_logs').insert({
    type: 'update_bet_open',
    status: 'success',
    message: `round_members oprettet: ${roundsToProvision.length} runder, ${roundMembersCreated} round_members`,
    metadata: { round_ids: provisionedIds, round_members_created: roundMembersCreated, timestamp: nowIso },
  })

  return NextResponse.json({ updated: true, timestamp: nowIso, rounds_provisioned: provisionedIds, round_members_created: roundMembersCreated })
}
