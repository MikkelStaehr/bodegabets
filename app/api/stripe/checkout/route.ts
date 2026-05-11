import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'

/**
 * Opretter en Stripe Checkout Session for medlemskab og returnerer URL.
 * Brugeren skal være logget ind. Reuser stripe_customer_id hvis profilen
 * allerede har en — ellers oprettes en ny Customer via Checkout's
 * customer_creation-flow.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', user.id)
    .single()

  // Allerede aktiv — undgå dobbelt-subscription
  if (profile?.subscription_status === 'active' || profile?.subscription_status === 'comped') {
    return NextResponse.json(
      { error: 'Du har allerede et aktivt medlemskab' },
      { status: 400 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      subscription_data: {
        metadata: { user_id: user.id },
      },
      success_url: `${appUrl}/profile/billing?subscribed=1`,
      cancel_url: `${appUrl}/subscribe?canceled=1`,
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Checkout session uden URL' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    console.error('[stripe/checkout] Fejl:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
