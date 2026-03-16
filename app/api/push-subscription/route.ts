import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

// POST — save or update push subscription
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { subscription } = await req.json()
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Ugyldig subscription' }, { status: 400 })
  }

  // Upsert based on endpoint to avoid duplicates
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        subscription,
        endpoint: subscription.endpoint,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — remove push subscription
export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint || typeof endpoint !== 'string' || endpoint.length > 500) {
    return NextResponse.json({ error: 'Ugyldig endpoint' }, { status: 400 })
  }

  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}

// GET — check if current user has a subscription
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  return NextResponse.json({ subscribed: (data?.length ?? 0) > 0 })
}
