import Stripe from 'stripe'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

export const STRIPE_PRICE_ID = requireEnv('STRIPE_PRICE_ID')

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'comped'
  | 'past_due'
  | 'canceled'

/** Mapper Stripe-subscription-status til vores interne enum. */
export function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    case 'incomplete':
    case 'paused':
    default:
      return 'none'
  }
}
