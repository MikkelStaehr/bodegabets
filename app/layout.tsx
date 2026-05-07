import type { Metadata } from 'next'
import { Playfair_Display, Barlow_Condensed, Barlow } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/layout/Footer'
import CookieBanner from '@/components/layout/CookieBanner'
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
  metadataBase: new URL('https://bodega-bets.com'),
  title: {
    default: 'Bodega Bets',
    template: '%s — Bodega Bets',
  },
  description: 'Spil mod vennerne i sport-fantasy spilrum. Fodbold-bets, cykling-fantasy og mesterskaber. Ingen rigtige penge.',
  keywords: ['fantasy', 'fodbold', 'cykling', 'sport', 'venner', 'spilrum', 'Tour de France', 'Premier League'],
  authors: [{ name: 'Bodega Bets' }],
  applicationName: 'Bodega Bets',
  appleWebApp: {
    title: 'Bodega Bets',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'da_DK',
    url: 'https://bodega-bets.com',
    siteName: 'Bodega Bets',
    title: 'Bodega Bets',
    description: 'Spil mod vennerne i sport-fantasy spilrum. Fodbold-bets, cykling-fantasy og mesterskaber. Ingen rigtige penge.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Bodega Bets',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bodega Bets',
    description: 'Spil mod vennerne i sport-fantasy spilrum. Ingen rigtige penge.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
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
            <CookieBanner />
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
