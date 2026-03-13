import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  // Opret response med request videresendt — nødvendigt for cookie-refresh
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Opdater request-cookies (til server components) OG response-cookies (til browser)
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Lokal JWT decode (ingen database roundtrip)
  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname

  // Hent profil én gang med begge felter — kun hvis bruger er logget ind
  let profile: { is_suspended: boolean; is_admin: boolean } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('is_suspended, is_admin')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // Suspend-tjek — redirect til /suspended
  if (
    profile?.is_suspended &&
    !path.startsWith('/suspended') &&
    !path.startsWith('/login') &&
    !path.startsWith('/register')
  ) {
    return NextResponse.redirect(new URL('/suspended', req.url))
  }

  // Beskyt /admin — kræver login + is_admin
  if (path.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Beskyt /dashboard og /games — kræver login
  if ((path.startsWith('/dashboard') || path.startsWith('/games')) && !user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/games/:path*',
    '/suspended',
  ],
}