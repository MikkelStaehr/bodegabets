'use client'

import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import AuthForm from '@/components/AuthForm'

const supabase = createBrowserSupabaseClient()

export default function LoginPage() {
  const router = useRouter()

  async function handleLogin(values: Record<string, string>): Promise<string | null> {
    const { email, password } = values

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('invalid_credentials')
      ) {
        return 'Forkert email eller adgangskode'
      }
      return error.message
    }

    router.push('/dashboard')
    router.refresh()
    return null
  }

  return (
    <AuthForm
      title="Velkommen tilbage"
      subtitle="Log ind for at se dine spil og afgive bets"
      fields={[
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          placeholder: 'din@email.dk',
          autoComplete: 'email',
        },
        {
          name: 'password',
          label: 'Adgangskode',
          type: 'password',
          placeholder: '••••••••',
          autoComplete: 'current-password',
        },
      ]}
      submitLabel="Log ind"
      loadingLabel="Logger ind..."
      footerText="Ingen konto endnu?"
      footerLinkLabel="Opret konto gratis"
      footerLinkHref="/register"
      onSubmit={handleLogin}
    />
  )
}
