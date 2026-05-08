// Sentry client-side initialization (Next.js 15+ konvention)
// Køres i browser før React hydration

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring (10% sampling for at holde quota lav)
  tracesSampleRate: 0.1,

  // Session replay — kun ved fejl (1% normalt, 100% når der er en error)
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Filtrér local development og kendte støj-fejl
  enabled: process.env.NODE_ENV === 'production',

  beforeSend(event, hint) {
    // Drop chrome-extension errors og andet ikke-actionable støj
    const err = hint.originalException as Error | undefined
    if (err?.message?.includes('chrome-extension://')) return null
    if (err?.message?.includes('ResizeObserver loop')) return null
    return event
  },
})

// Required for navigation instrumentation i App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
