/**
 * Email-sender wrapper omkring Resend SDK.
 *
 * Brug: kun til APP-LEVEL transactional mails (welcome, archive notifications,
 * reminders). Auth-mails (signup verify, password reset) sendes af Supabase
 * via custom SMTP — ikke direkte herfra.
 *
 * Setup:
 *   1. Sign up resend.com (premium for eget domain)
 *   2. Add domain bodega-bets.com → verify DNS records (SPF, DKIM)
 *   3. Create API key → tilføj til .env.local + Vercel:
 *        RESEND_API_KEY=re_...
 *
 * Hvis RESEND_API_KEY ikke er sat returnerer sendEmail() bare false →
 * koden crasher ikke i lokal dev / før setup er færdig.
 */

import { Resend } from 'resend'
import { captureException } from '@/lib/sentry'

const FROM_DEFAULT = 'Bodega Bets <hej@bodega-bets.com>'

let resendClient: Resend | null = null

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

export type SendEmailOptions = {
  to: string | string[]
  subject: string
  /** HTML body (plain-text genereres automatisk hvis ikke angivet) */
  html: string
  /** Valgfri plain-text fallback */
  text?: string
  /** Default 'Bodega Bets <hej@bodega-bets.com>' — overrides hvis specifik kategori */
  from?: string
  /** Reply-to (typisk hej@bodega-bets.com) */
  replyTo?: string
  /** Tags til Resend dashboard analytics */
  tags?: { name: string; value: string }[]
}

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; id?: string; error?: string }> {
  const client = getClient()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[email] RESEND_API_KEY not set — skipping send', options.subject)
    }
    return { ok: false, error: 'Email service not configured' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: options.from ?? FROM_DEFAULT,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo ?? 'hej@bodega-bets.com',
      tags: options.tags,
    })

    if (error) {
      captureException(error, { emailSubject: options.subject })
      return { ok: false, error: error.message }
    }

    return { ok: true, id: data?.id }
  } catch (err) {
    captureException(err, { emailSubject: options.subject })
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
