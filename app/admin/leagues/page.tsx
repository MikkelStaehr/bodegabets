import { redirect } from 'next/navigation'

export default function LeaguesRedirect() {
  redirect('/admin?tab=fixtures')
}
