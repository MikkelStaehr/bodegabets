import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIp } from '@/lib/rateLimit'

type Props = { params: Promise<{ id: string }> }

const MAX_MESSAGE_LENGTH = 500
const MESSAGES_PAGE_SIZE = 100

/**
 * GET /api/games/[id]/messages
 * Henter de seneste beskeder for et spilrum (max 100). Returneres i kronologisk
 * orden (ældste først, så klient kan render top → bund og auto-scrolle).
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const gameId = Number(id)
  if (!gameId) return NextResponse.json({ error: 'Ugyldigt spilrum-id' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  // Membership-tjek
  const { data: membership } = await supabaseAdmin
    .from('game_members').select('id')
    .eq('game_id', gameId).eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  // Hent seneste beskeder + bruger-info
  const { data: messages, error } = await supabaseAdmin
    .from('gameroom_messages')
    .select('id, user_id, content, created_at, profiles:user_id(username, avatar_url)')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reverse til ældste-først (klient render top-til-bund)
  const ordered = [...(messages ?? [])].reverse()
  return NextResponse.json({ messages: ordered })
}

/**
 * POST /api/games/[id]/messages
 * Body: { content: string }
 * Opretter en besked. Rate-limit: 10 beskeder pr. minut pr. bruger.
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

  // Membership-tjek
  const { data: membership } = await supabaseAdmin
    .from('game_members').select('id')
    .eq('game_id', gameId).eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Ikke medlem' }, { status: 403 })

  const { data: inserted, error } = await supabaseAdmin
    .from('gameroom_messages')
    .insert({ game_id: gameId, user_id: user.id, content })
    .select('id, user_id, content, created_at, profiles:user_id(username, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: inserted })
}
