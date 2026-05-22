import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { lazyProxy } from './lazyProxy'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

// Klienterne initialiseres LAZY (se lib/lazyProxy): env-vars læses og
// klient-instansen oprettes først ved faktisk brug, ikke ved module-load.
// Dermed kræver `next build` ingen runtime-secrets.

// Anon-client (public key)
export const supabase = lazyProxy(() =>
  createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
)

// Server-side client med cookie-baseret auth (bruger session fra cookies)
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Kan ikke sætte cookies i Server Components — ignorér
          }
        },
      },
    }
  )
}

// Admin-client med service role key (bypass RLS)
export const supabaseAdmin = lazyProxy(() =>
  createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
)
