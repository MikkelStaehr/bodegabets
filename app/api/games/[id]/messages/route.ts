import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIp } from '@/lib/rateLimit'

type Props = { params: Promise<{ id: string }> }

const MAX_MESSAGE_LENGTH = 500
const MESSAGES_PAGE_SIZE = 100

type RawMessage = { id: number; user_id: string; content: string; created_at: string }

/**
 * Hent profile-info for user_ids i ét hug og merge ind i message-rækkerne.
 * gameroom_messages.user_id peger på auth.users (ikke public.profiles), så
 * PostgREST kan ikke følge relationen automatisk via embedded select.
 */
async function attachProfiles(messages: RawMessage[]) {
  if (messages.length === 0) return [] as (RawMessage & { profiles: { username: string; avatar_url: string | null } | null })[]
  const userIds = [...new Set(messages.map((m) => m.user_id))]
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds)
  const profileMap = new Map<string, { username: string; avatar_url: string | null }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, {
      username: (p.username as string) ?? 'Anonym',
      avatar_url: (p.avatar_url as string | null) ?? null,
    })
  }
  return messages.map((m) => ({ ...m, profiles: profileMap.get(m.user_id) ?? null }))
}

/**
 * GET /api/games/[id]/messages
 * Henter de seneste beskeder (max 100). Returneres i kronologisk orden
 * (ældste først).
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = Number(id)
  if (!gameId) return NextResponse.json({ error: 'Ugyldigt spilrum-id' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { data: membership } = await supabaseAdmin
    .from('game_members').select('id')
    .eq('game_id', gameId).eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  const { data: messages, error } = await supabaseAdmin
    .from('gameroom_messages')
    .select('id, user_id, content, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withProfiles = await attachProfiles((messages ?? []) as RawMessage[])
  return NextResponse.json({ messages: withProfiles.reverse() })
}

/**
 * POST /api/games/[id]/messages
 * Body: { content: string }
 * Rate-limit: 10 beskeder pr. minut pr. bruger.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = Number(id)
  if (!gameId) return NextResponse.json({ error: 'Ugyldigt spilrum-id' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { success } = rateLimit(getIp(req), `messages:${user.id}`, 10, 60 * 1000)
  if (!success) {
    return NextResponse.json({ error: 'For mange beskeder for hurtigt. Vent lidt.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({})) as { content?: string }
  const content = (body.content ?? '').trim()
  if (!content) return NextResponse.json({ error: 'Beskeden er tom' }, { status: 400 })
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Maks ${MAX_MESSAGE_LENGTH} tegn` }, { status: 400 })
  }

  const { data: membership } = await supabaseAdmin
    .from('game_members').select('id')
    .eq('game_id', gameId).eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  const { data: inserted, error } = await supabaseAdmin
    .from('gameroom_messages')
    .insert({ game_id: gameId, user_id: user.id, content })
    .select('id, user_id, content, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [withProfile] = await attachProfiles([inserted as RawMessage])
  return NextResponse.json({ message: withProfile })
}
