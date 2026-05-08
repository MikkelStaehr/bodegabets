// Server + edge runtime instrumentation (Next.js standard)
// Loader Sentry config baseret på runtime

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...(args as Parameters<typeof Sentry.captureRequestError>))
}
