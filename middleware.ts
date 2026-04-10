import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return res

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname

  // Skip middleware entirely for preview route
  if (path.startsWith('/preview')) return res

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

  // Protect /admin
  if (path.startsWith('/admin')) {
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
