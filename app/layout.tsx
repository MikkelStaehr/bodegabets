import type { Metadata } from 'next'
import { Playfair_Display, Barlow_Condensed, Barlow } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/layout/Footer'
import NavbarScrollHandler from '@/components/layout/NavbarScrollHandler'
import OnboardingProvider from '@/components/layout/OnboardingProvider'
import { createServerSupabaseClient } from '@/lib/supabase'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--ff-display',
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--ff-condensed',
  display: 'swap',
})

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--ff-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bodega Bets',
  description: 'Spil mod vennerne. Ingen rigtige penge.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('username, points, is_admin, onboarding_completed').eq('id', user.id).single()
    : { data: null }

  return (
    <html
      lang="da"
      className={`${playfair.variable} ${barlowCondensed.variable} ${barlow.variable}`}
    >
      <body className="antialiased">
        <NavbarScrollHandler />
        <ToastProvider>
          <div className="min-h-screen bg-cream flex flex-col">
            <Navbar
              username={profile?.username}
              isAdmin={(profile as { is_admin?: boolean } | null)?.is_admin === true}
            />
            <main className="flex-1">
              {user ? (
                <OnboardingProvider onboardingCompleted={profile?.onboarding_completed ?? true}>
                  {children}
                </OnboardingProvider>
              ) : (
                children
              )}
            </main>
            <Footer />
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
