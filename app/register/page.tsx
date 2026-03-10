'use client'

import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import AuthForm from '@/components/AuthForm'

const supabase = createBrowserSupabaseClient()

export default function RegisterPage() {
  const router = useRouter()

  async function handleRegister(values: Record<string, string>): Promise<string | null> {
    const { username, email, password } = values

    if (username.trim().length < 3) {
      return 'Brugernavn skal være mindst 3 tegn'
    }
    if (password.length < 6) {
      return 'Adgangskode skal være mindst 6 tegn'
    }

    // Opret auth-bruger — brugernavn sendes som metadata og oprettes via trigger
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() },
      },
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        return 'Denne email er allerede i brug'
      }
      return signUpError.message
    }

    router.push('/dashboard')
    router.refresh()
    return null
  }

  return (
    <AuthForm
      title="Opret konto"
      subtitle="Gratis at tilmelde sig — ingen invitationskode nødvendig"
      fields={[
        {
          name: 'username',
          label: 'Brugernavn',
          type: 'text',
          placeholder: 'dit_brugernavn',
          autoComplete: 'username',
        },
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
          autoComplete: 'new-password',
        },
      ]}
      submitLabel="Opret konto"
      loadingLabel="Opretter konto..."
      footerText="Har du allerede en konto?"
      footerLinkLabel="Log ind her"
      footerLinkHref="/login"
      onSubmit={handleRegister}
    />
  )
}
