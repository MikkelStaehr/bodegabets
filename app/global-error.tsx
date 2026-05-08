'use client'

// Global error boundary — fanger fejl fra layout og root.
// Sender til Sentry og viser branded error-side.
// Kræver "use client" og egen <html><body> da den erstatter hele træet.

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="da">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F2EDE4' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <p style={{
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#7a7060', marginBottom: 12,
            }}>
              Fejl
            </p>
            <h1 style={{
              fontSize: 36, fontWeight: 700, color: '#1a3329',
              margin: '0 0 16px', lineHeight: 1.1,
            }}>
              Noget gik galt
            </h1>
            <p style={{ color: '#5C5C4A', marginBottom: 32, lineHeight: 1.5 }}>
              Vi har modtaget fejlen og kigger på den. Prøv at genindlæse siden,
              eller gå tilbage til dashboardet.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={reset}
                style={{
                  padding: '12px 24px',
                  background: '#1a3329',
                  color: '#F2EDE4',
                  border: 'none',
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Prøv igen
              </button>
              <Link
                href="/dashboard"
                style={{
                  padding: '12px 24px',
                  border: '1px solid #1a3329',
                  color: '#1a3329',
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                Til dashboard
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
