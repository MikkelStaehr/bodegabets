import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  // Eksponér pathname til server components (root layout læser denne for at
  // skjule global Navbar/Footer på marketing-ruter som /landing-v2). Sættes
  // på request-headers så den overlever Supabase' cookie-callback der
  // reassigner res.
  const forwardedHeaders = new Headers(req.headers)
  forwardedHeaders.set('x-pathname', req.nextUrl.pathname)

  let res = NextResponse.next({ request: { headers: forwardedHeaders } })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return res

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: { headers: forwardedHeaders } })
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/games') || path.startsWith('/admin')

  // Fetch profile once (suspend + admin check in single query)
  let profile: { is_suspended: boolean; is_admin: boolean } | null = null
  if (user && (isProtected || !path.startsWith('/suspended'))) {
    const { data } = await supabase
      .from('profiles')
      .select('is_suspended, is_admin')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // Suspend check
  if (user && profile?.is_suspended && !path.startsWith('/suspended') && !path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/suspended', req.url))
  }

  // Protect /admin — kræv login + admin-rolle. AAL2-enforcement er midlertidigt
  // fjernet da step-up flowet ikke virkede pålideligt. 2FA er stadig
  // tilgængelig på /profile/security som frivillig konto-beskyttelse.
  if (path.startsWith('/admin') && !path.startsWith('/admin/verify')) {
    if (!user) return NextResponse.redirect(new URL('/login', req.url))
    if (!profile?.is_admin) return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Protect /dashboard and /games
  if ((path.startsWith('/dashboard') || path.startsWith('/games')) && !user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
