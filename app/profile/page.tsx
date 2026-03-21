import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import ProfileEditClient from './ProfileEditClient'

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  return (
    <ProfileEditClient
      userId={user.id}
      userEmail={user.email ?? ''}
      initialUsername={profile?.username ?? ''}
    />
  )
}
