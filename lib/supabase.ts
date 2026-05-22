import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

// Klienterne initialiseres LAZY: env-vars læses og klient-instansen oprettes
// først ved faktisk brug (i en request), ikke ved module-load. Dermed kræver
// `next build` — som evaluerer route-moduler for at samle page-data — ingen
// runtime-secrets, og builds fejler aldrig pga. manglende env-vars.
function lazyClient(factory: () => SupabaseClient): SupabaseClient {
  let instance: SupabaseClient | null = null
  const resolve = (): SupabaseClient => (instance ??= factory())
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      const client = resolve()
      const value = Reflect.get(client, prop)
      return typeof value === 'function' ? value.bind(client) : value
    },
  })
}

// Anon-client (public key)
export const supabase = lazyClient(() =>
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
export const supabaseAdmin = lazyClient(() =>
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
