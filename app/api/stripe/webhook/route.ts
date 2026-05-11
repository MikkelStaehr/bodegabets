import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe, mapStripeStatus } from '@/lib/stripe'
import type Stripe from 'stripe'

// Vigtigt: Stripe webhook signature kræver RAW request body (ikke parsed).
// Next 15 App Router giver os det via request.text() før vi rører JSON.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET mangler')
    return NextResponse.json({ error: 'Webhook ikke konfigureret' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Mangler signature' }, { status: 400 })
  }

  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt'
    console.error('[stripe/webhook] Signature-fejl:', message)
    return NextResponse.json({ error: `Signature: ${message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object)
        break
      default:
        // Ignorér events vi ikke abonnerer på
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt'
    console.error(`[stripe/webhook] Fejl ved ${event.type}:`, message)
    // Return 200 alligevel — vi vil ikke have Stripe til at retry forevigt
    // på en bug i vores kode. Fejlen er logget.
    return NextResponse.json({ received: true, error: message })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.user_id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id

  if (!userId || !customerId) {
    console.warn('[stripe/webhook] checkout.session.completed mangler user_id eller customer_id')
    return
  }

  // Marker som active straks så brugeren får adgang uden at vente på
  // customer.subscription.created. Subscription-events finjusterer senere.
  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId ?? null,
      subscription_status: 'active',
    })
    .eq('id', userId)
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  const periodEndIso =
    'current_period_end' in sub && typeof sub.current_period_end === 'number'
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null

  const update = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    subscription_status: mapStripeStatus(sub.status),
    subscription_current_period_end: periodEndIso,
  }

  // Find profile via user_id (metadata) eller stripe_customer_id (fallback)
  if (userId) {
    await supabaseAdmin.from('profiles').update(update).eq('id', userId)
  } else {
    await supabaseAdmin.from('profiles').update(update).eq('stripe_customer_id', customerId)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id
  if (!customerId) return

  await supabaseAdmin
    .from('profiles')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId)
}
