import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
]

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

// Wrap config med Sentry — kun aktiv hvis SENTRY_AUTH_TOKEN er sat
// (uploader source maps + tunneller /monitoring rute så ad-blockers ikke skipper events)
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'bodega-bets',
  project: process.env.SENTRY_PROJECT ?? 'javascript-nextjs',
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Tunneller events gennem din egen domain → forbi ad-blockers
  tunnelRoute: '/monitoring',

  // Skjul Sentry's CLI logs i build (rene byggelogs)
  silent: !process.env.CI,

  // Source maps: kun upload hvis token er sat
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,

  // Automatic vercel cron monitors
  automaticVercelMonitors: true,
})
