import type { Metadata } from 'next'
import { Playfair_Display, Barlow_Condensed, Barlow, Lobster, Pacifico } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/layout/Footer'
import { createServerSupabaseClient } from '@/lib/supabase'
import './globals.css'

const lobster = Lobster({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-lobster',
  display: 'swap',
})

const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pacifico',
  display: 'swap',
})

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
    ? await supabase.from('profiles').select('username, points, is_admin').eq('id', user.id).single()
    : { data: null }

  return (
    <html
      lang="da"
      className={`${playfair.variable} ${barlowCondensed.variable} ${barlow.variable} ${lobster.variable} ${pacifico.variable}`}
    >
      <body className="antialiased">
        <ToastProvider>
          <div className="min-h-screen bg-cream flex flex-col">
            <Navbar
              username={profile?.username}
              isAdmin={(profile as { is_admin?: boolean } | null)?.is_admin === true}
            />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
