/**
 * Sentry skeleton — aktiveres når NEXT_PUBLIC_SENTRY_DSN sættes.
 *
 * Setup-vejledning når du er klar:
 *   1. Sign up på sentry.io → New Project → Next.js → kopiér DSN
 *   2. Tilføj til .env.local + Vercel:
 *        NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
 *        SENTRY_AUTH_TOKEN=...   (til source maps upload)
 *        SENTRY_ORG=din-org
 *        SENTRY_PROJECT=bodega-bets
 *   3. Installer pakker:
 *        npm install @sentry/nextjs
 *   4. Kør Sentry's CLI-wizard (anbefalet):
 *        npx @sentry/wizard@latest -i nextjs
 *      Den opretter sentry.client.config.ts, sentry.server.config.ts og
 *      sentry.edge.config.ts automatisk.
 *   5. Bygget kommer auto til at uploade source maps + tunnel /monitoring
 *      route bypasser ad-blockers.
 *
 * Indtil DSN er sat returnerer denne helper bare null/no-op så koden
 * kan kalde captureException(err) trygt uden at crashe.
 */

export function captureException(_err: unknown, _context?: Record<string, unknown>): void {
  // No-op indtil Sentry er installeret.
  // Når @sentry/nextjs er på plads, importér og brug:
  //   import * as Sentry from '@sentry/nextjs'
  //   Sentry.captureException(_err, { extra: _context })
  if (process.env.NODE_ENV !== 'production') {
    console.error('[captureException]', _err, _context)
  }
}

export function captureMessage(_msg: string, _level: 'info' | 'warning' | 'error' = 'info'): void {
  // No-op indtil Sentry er installeret.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${_level}]`, _msg)
  }
}
