/**
 * Sentry helpers — wrapper rundt om @sentry/nextjs med graceful fallback
 * når DSN ikke er sat (lokal dev uden Sentry).
 */

import * as Sentry from '@sentry/nextjs'

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[captureException]', err, context)
  }
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${level}]`, msg)
  }
  Sentry.captureMessage(msg, level)
}

/** Tilføj user-context så fejl tagges per bruger (overhold privacy: kun id + email-domain). */
export function setUser(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    // Kun email-domæne, ikke fuld adresse — privacy first
    email_domain: email?.split('@')[1],
  })
}

export function clearUser(): void {
  Sentry.setUser(null)
}
